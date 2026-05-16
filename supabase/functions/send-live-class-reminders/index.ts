// Sends live class reminders 15 minutes before the class starts.
// Triggered every 5 minutes by pg_cron.
// Idempotency key includes the class ID + user ID so the same person never
// gets duplicate reminders even if cron fires multiple times.

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  // Look 5-20 minutes ahead so cron firing every 5 minutes covers the window.
  const { data: rows, error } = await supabase.rpc(
    'upcoming_live_class_reminders',
    { _lookahead_minutes: 20 },
  )

  if (error) {
    console.error('Failed to fetch upcoming reminders', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let sent = 0
  let skipped = 0

  for (const row of (rows as any[]) ?? []) {
    // Check user preferences
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('email_live_class_reminder, inapp_live_class_reminder')
      .eq('user_id', row.user_id)
      .maybeSingle()

    const wantsEmail = prefs?.email_live_class_reminder ?? true
    const wantsInApp = prefs?.inapp_live_class_reminder ?? true

    // In-app notification
    if (wantsInApp) {
      await supabase.from('notifications').insert({
        user_id: row.user_id,
        title: 'Live class starting soon',
        body: `${row.class_title} with ${row.educator_name ?? 'your educator'} starts soon.`,
        type: 'live_class',
        link: '/live-classes',
      })
    }

    // Email
    if (wantsEmail && row.user_email) {
      const startsAt = new Date(row.starts_at).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Kolkata',
      })
      try {
        await supabase.functions.invoke('send-transactional-email', {
          body: {
            templateName: 'live-class-reminder',
            recipientEmail: row.user_email,
            idempotencyKey: `live-class-reminder-${row.class_id}-${row.user_id}`,
            templateData: {
              studentName: row.user_name,
              classTitle: row.class_title,
              educatorName: row.educator_name,
              subject: row.subject,
              startsAt: `${startsAt} IST`,
              joinUrl: 'https://arke.pro/live-classes',
            },
          },
        })
        sent++
      } catch (e) {
        console.error('Failed to enqueue reminder', e)
        skipped++
      }
    } else {
      skipped++
    }
  }

  return new Response(
    JSON.stringify({ sent, skipped, total: rows?.length ?? 0 }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  )
})
