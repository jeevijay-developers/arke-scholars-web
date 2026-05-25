import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Base URL for reading stored objects — bucket IS in the read path
const S3_BASE = 'https://s3.ap-tokyo.megas4.com/biijszzsfufvateaffbvtjapmculhceod7agr'

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

  let lessonId: string
  let quality: string
  try {
    const body = await req.json()
    lessonId = String(body.lessonId ?? '')
    quality = String(body.quality ?? 'auto')
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

  const admin = createClient(supabaseUrl, serviceKey)

  // Get lesson and its course
  const { data: lesson, error: lessonError } = await admin
    .from('lessons')
    .select('course_id, video_url')
    .eq('id', lessonId)
    .maybeSingle()

  if (lessonError || !lesson) {
    return new Response(JSON.stringify({ error: 'Lesson not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!lesson.video_url) {
    return new Response(JSON.stringify({ error: 'No video for this lesson' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Gate: student must have a paid enrollment (payment_id IS NOT NULL)
  const { data: enrollment } = await admin
    .from('enrollments')
    .select('payment_id')
    .eq('user_id', user.id)
    .eq('course_id', lesson.course_id)
    .not('payment_id', 'is', null)
    .maybeSingle()

  if (!enrollment) {
    return new Response(
      JSON.stringify({ error: 'Purchase required to watch this video' }),
      {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // video_url is stored as the S3 key, e.g. "arke/{lessonId}.mp4"
  // Quality variants follow the naming convention: "arke/{lessonId}_720p.mp4"
  const VALID_QUALITIES = ['240p', '360p', '720p', '1080p']
  let videoPath = lesson.video_url
  if (quality && VALID_QUALITIES.includes(quality)) {
    const dotIdx = lesson.video_url.lastIndexOf('.')
    const base = dotIdx !== -1 ? lesson.video_url.slice(0, dotIdx) : lesson.video_url
    const ext  = dotIdx !== -1 ? lesson.video_url.slice(dotIdx)    : '.mp4'
    videoPath = `${base}_${quality}${ext}`
  }
  const videoUrl = `${S3_BASE}/${videoPath}`

  return new Response(JSON.stringify({ videoUrl }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
