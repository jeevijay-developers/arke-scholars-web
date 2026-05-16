import { createClient } from 'npm:@supabase/supabase-js@2'
import { Webhook } from 'npm:svix'

// Resend webhook event types that trigger suppression
type ResendEventType = 'email.bounced' | 'email.complained'

interface ResendWebhookEvent {
  type: ResendEventType
  data: {
    email_id?: string
    to?: string[]
    from?: string
    subject?: string
    [key: string]: unknown
  }
}

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function mapEventToReason(type: ResendEventType): 'bounce' | 'complaint' {
  if (type === 'email.complained') return 'complaint'
  return 'bounce'
}

function mapReasonToStatus(reason: string): 'bounced' | 'complained' | 'suppressed' {
  switch (reason) {
    case 'bounce': return 'bounced'
    case 'complaint': return 'complained'
    default: return 'suppressed'
  }
}

function mapReasonToMessage(reason: string): string {
  switch (reason) {
    case 'bounce': return 'Permanent bounce — email address is invalid or rejected'
    case 'complaint': return 'Spam complaint — recipient marked email as spam'
    default: return 'Email suppressed'
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!webhookSecret || !supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables')
    return jsonResponse({ error: 'Server configuration error' }, 500)
  }

  // Verify Svix webhook signature (used by Resend)
  const body = await req.text()
  let event: ResendWebhookEvent
  try {
    const wh = new Webhook(webhookSecret)
    event = wh.verify(body, {
      'svix-id': req.headers.get('svix-id') ?? '',
      'svix-timestamp': req.headers.get('svix-timestamp') ?? '',
      'svix-signature': req.headers.get('svix-signature') ?? '',
    }) as ResendWebhookEvent
  } catch (error) {
    console.error('Webhook signature verification failed', { error })
    return jsonResponse({ error: 'Invalid signature' }, 401)
  }

  // Only handle suppression-relevant events
  if (event.type !== 'email.bounced' && event.type !== 'email.complained') {
    return jsonResponse({ success: true, skipped: true })
  }

  const recipientEmail = event.data.to?.[0]
  if (!recipientEmail) {
    console.error('No recipient email in webhook payload', { event })
    return jsonResponse({ error: 'Invalid payload: missing recipient' }, 400)
  }

  const reason = mapEventToReason(event.type)
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const normalizedEmail = recipientEmail.toLowerCase()

  // Upsert to suppressed_emails (idempotent — safe for retries)
  const { error: suppressError } = await supabase
    .from('suppressed_emails')
    .upsert(
      {
        email: normalizedEmail,
        reason,
        metadata: { event_type: event.type, email_id: event.data.email_id },
      },
      { onConflict: 'email' }
    )

  if (suppressError) {
    console.error('Failed to upsert suppressed email', {
      error: suppressError,
      email_redacted: normalizedEmail[0] + '***@' + normalizedEmail.split('@')[1],
    })
    return jsonResponse({ error: 'Failed to write suppression' }, 500)
  }

  // Append log entry for the suppression event
  const { error: insertError } = await supabase
    .from('email_send_log')
    .insert({
      message_id: event.data.email_id ?? null,
      template_name: 'system',
      recipient_email: normalizedEmail,
      status: mapReasonToStatus(reason),
      error_message: mapReasonToMessage(reason),
      metadata: { event_type: event.type },
    })

  if (insertError) {
    console.warn('Failed to insert email_send_log', { error: insertError })
  }

  console.log('Suppression processed', {
    email_redacted: normalizedEmail[0] + '***@' + normalizedEmail.split('@')[1],
    reason,
    event_type: event.type,
  })

  return jsonResponse({ success: true })
})
