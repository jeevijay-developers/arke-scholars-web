import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const S3_ENDPOINT  = 'https://s3.ap-tokyo.megas4.com'
// Public read base — bucket path is required for GET even though PUT doesn't need it
const S3_READ_BASE = 'https://s3.ap-tokyo.megas4.com/biijszzsfufvateaffbvtjapmculhceod7agr'
const REGION   = 'us-east-1'
const SERVICE  = 's3'
const EXPIRES  = 3600 // presigned URL valid for 1 hour

// --- AWS4 signing helpers ---

async function hmac(key: Uint8Array, msg: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg)))
}

function toHex(buf: Uint8Array): string {
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function sha256hex(data: string): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))))
}

// Build a presigned PUT URL (auth in query string, no custom request headers needed).
// This avoids CORS preflight issues that arise when browsers send Authorization headers.
async function buildPresignedPutUrl(
  accessKeyId: string,
  secretKey: string,
  host: string,
  key: string,
  contentType: string,
  amzDate: string,
  dateStamp: string,
): Promise<string> {
  const credential    = `${accessKeyId}/${dateStamp}/${REGION}/${SERVICE}/aws4_request`
  const signedHeaders = 'content-type;host'

  // Canonical query string — params must be sorted alphabetically and URI-encoded
  const qpRaw: Record<string, string> = {
    'X-Amz-Algorithm':    'AWS4-HMAC-SHA256',
    'X-Amz-Credential':   credential,
    'X-Amz-Date':         amzDate,
    'X-Amz-Expires':      String(EXPIRES),
    'X-Amz-SignedHeaders': signedHeaders,
  }
  const canonicalQS = Object.keys(qpRaw)
    .sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(qpRaw[k])}`)
    .join('&')

  const canonicalRequest = [
    'PUT',
    `/${key}`,
    canonicalQS,
    `content-type:${contentType}\nhost:${host}\n`,
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n')

  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256hex(canonicalRequest),
  ].join('\n')

  const kDate    = await hmac(new TextEncoder().encode('AWS4' + secretKey), dateStamp)
  const kRegion  = await hmac(kDate, REGION)
  const kService = await hmac(kRegion, SERVICE)
  const kSigning = await hmac(kService, 'aws4_request')
  const signature = toHex(await hmac(kSigning, stringToSign))

  return `${S3_ENDPOINT}/${key}?${canonicalQS}&X-Amz-Signature=${encodeURIComponent(signature)}`
}

// ---

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: userError } = await userClient.auth.getUser()
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const admin = createClient(supabaseUrl, serviceKey)
  const [{ data: isAdmin }, { data: isSuperAdmin }] = await Promise.all([
    admin.rpc('has_role', { _user_id: user.id, _role: 'admin' }),
    admin.rpc('has_role', { _user_id: user.id, _role: 'super_admin' }),
  ])
  if (!isAdmin && !isSuperAdmin) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let lessonId: string
  let fileName: string
  let contentType: string
  let quality: string
  try {
    const body  = await req.json()
    lessonId    = String(body.lessonId  ?? '')
    fileName    = String(body.fileName  ?? '')
    contentType = String(body.contentType ?? body.fileType ?? 'video/mp4')
    quality     = String(body.quality   ?? 'original')
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!lessonId && !fileName) {
    return new Response(JSON.stringify({ error: 'lessonId or fileName is required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const accessKeyId = Deno.env.get('S3_ACCESS_KEY_ID')!
  const secretKey   = Deno.env.get('S3_SECRET_ACCESS_KEY')!

  const now       = new Date()
  const amzDate   = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  const dateStamp = amzDate.slice(0, 8)

  // Determine S3 key:
  // - Lesson uploads: keyed by lessonId with optional quality suffix
  // - Content-item uploads: keyed by a random UUID so filenames cannot collide or be guessed
  let key: string
  if (lessonId) {
    const VALID_QUALITIES = ['720p', '360p', '240p']
    key = VALID_QUALITIES.includes(quality)
      ? `arke/${lessonId}_${quality}.mp4`
      : `arke/${lessonId}.mp4`
  } else {
    const ext = fileName.includes('.')
      ? fileName.slice(fileName.lastIndexOf('.')).toLowerCase()
      : '.mp4'
    const uuid = crypto.randomUUID()
    key = `content-items/${uuid}${ext}`
  }

  const host        = 's3.ap-tokyo.megas4.com'
  const uploadUrl   = await buildPresignedPutUrl(
    accessKeyId, secretKey, host, key, contentType, amzDate, dateStamp,
  )

  return new Response(JSON.stringify({
    // uploadUrl is now a presigned URL — browser just PUTs with Content-Type, no auth headers
    uploadUrl,
    // fileUrl is the public GET URL — bucket path is required for reads
    fileUrl: `${S3_READ_BASE}/${key}`,
    key,
  }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
