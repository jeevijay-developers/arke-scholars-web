import { S3Client, PutObjectCommand } from 'npm:@aws-sdk/client-s3'
import { getSignedUrl } from 'npm:@aws-sdk/s3-request-presigner'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Verify caller and check admin role
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: userError } = await userClient.auth.getUser()
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const admin = createClient(supabaseUrl, serviceKey)
  const [{ data: isAdmin }, { data: isSuperAdmin }] = await Promise.all([
    admin.rpc('has_role', { _user_id: user.id, _role: 'admin' }),
    admin.rpc('has_role', { _user_id: user.id, _role: 'super_admin' }),
  ])

  if (!isAdmin && !isSuperAdmin) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let lessonId: string
  let contentType: string
  try {
    const body = await req.json()
    lessonId = String(body.lessonId ?? '')
    contentType = String(body.contentType ?? 'video/mp4')
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!lessonId) {
    return new Response(JSON.stringify({ error: 'lessonId is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const s3 = new S3Client({
    endpoint: Deno.env.get('S3_ENDPOINT'),
    region: 'ap-tokyo',
    credentials: {
      accessKeyId: Deno.env.get('S3_ACCESS_KEY_ID')!,
      secretAccessKey: Deno.env.get('S3_SECRET_ACCESS_KEY')!,
    },
    forcePathStyle: true,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })

  const key = `arke/${lessonId}.mp4`
  const command = new PutObjectCommand({
    Bucket: Deno.env.get('S3_BUCKET'),
    Key: key,
    ContentType: contentType,
  })

  try {
    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: 1800,
      unhoistableHeaders: new Set(['x-amz-checksum-crc32']),
    })
    return new Response(JSON.stringify({ uploadUrl, key }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Failed to generate presigned PUT URL', err)
    return new Response(JSON.stringify({ error: 'Failed to generate upload URL' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
