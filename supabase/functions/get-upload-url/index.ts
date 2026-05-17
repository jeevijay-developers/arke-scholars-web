import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const S3_ENDPOINT = 'https://s3.ap-tokyo.megas4.com'
const REGION = 'us-east-1'
const SERVICE = 's3'

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

async function buildAuthHeader(
  accessKeyId: string,
  secretKey: string,
  method: string,
  path: string,
  signedHeaders: Record<string, string>, // lowercase key → value, sorted
  amzDate: string,
  dateStamp: string,
): Promise<string> {
  const sortedNames = Object.keys(signedHeaders).sort()
  const canonicalHeaders = sortedNames.map(k => `${k}:${signedHeaders[k]}\n`).join('')
  const signedHeadersStr = sortedNames.join(';')

  const canonicalRequest = [
    method, path, '',
    canonicalHeaders,
    signedHeadersStr,
    'UNSIGNED-PAYLOAD',
  ].join('\n')

  const hashedCanonical = await sha256hex(canonicalRequest)
  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${hashedCanonical}`

  const kDate    = await hmac(new TextEncoder().encode('AWS4' + secretKey), dateStamp)
  const kRegion  = await hmac(kDate, REGION)
  const kService = await hmac(kRegion, SERVICE)
  const kSigning = await hmac(kService, 'aws4_request')
  const signature = toHex(await hmac(kSigning, stringToSign))

  return `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeadersStr}, Signature=${signature}`
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
  let contentType: string
  let contentLength: number
  try {
    const body = await req.json()
    lessonId      = String(body.lessonId ?? '')
    contentType   = String(body.contentType ?? 'video/mp4')
    contentLength = Number(body.contentLength ?? 0)
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!lessonId || !contentLength) {
    return new Response(JSON.stringify({ error: 'lessonId and contentLength are required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const accessKeyId = Deno.env.get('S3_ACCESS_KEY_ID')!
  const secretKey   = Deno.env.get('S3_SECRET_ACCESS_KEY')!

  const now       = new Date()
  const amzDate   = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  const dateStamp = amzDate.slice(0, 8)

  const key       = `arke/${lessonId}.mp4`
  const uploadUrl = `${S3_ENDPOINT}/${key}`
  const host      = 's3.ap-tokyo.megas4.com'

  // These are the headers the browser will send in the PUT — must match exactly
  const signedHeaders: Record<string, string> = {
    'content-type':          contentType,
    'host':                  host,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    'x-amz-date':            amzDate,
  }

  const authorization = await buildAuthHeader(
    accessKeyId, secretKey, 'PUT', `/${key}`, signedHeaders, amzDate, dateStamp,
  )

  return new Response(JSON.stringify({
    uploadUrl,
    key,
    headers: {
      'Authorization':        authorization,
      'Content-Type':         contentType,
      'X-Amz-Content-Sha256': 'UNSIGNED-PAYLOAD',
      'X-Amz-Date':           amzDate,
    },
  }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
