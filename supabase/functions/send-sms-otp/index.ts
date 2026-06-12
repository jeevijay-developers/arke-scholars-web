// Supabase "Send SMS Hook" → MSG91 relay.
//
// Supabase Auth generates, stores, and verifies the OTP. This function only
// DELIVERS the code: Supabase POSTs the generated OTP here (signed with the
// Standard Webhooks spec), and we forward it to MSG91's send-OTP API, passing
// the Supabase-generated code as the otp param.
//
// Frontend is unchanged — it still calls supabase.auth.signInWithOtp /
// verifyOtp. India (+91) only.
//
// Auth: this hook is NOT called by the browser. verify_jwt = false in
// config.toml; authenticity is proven by the standardwebhooks signature using
// SEND_SMS_HOOK_SECRET. Do not add a JWT/CORS gate.

import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'

// MSG91 send-OTP endpoint. NOTE: we use /otp (not /flow) because this DLT
// template/sender only actually DELIVERS via the OTP route — the Flow API
// returns type:success but silently drops the SMS (no delivery log).
//
// We pass our OWN otp param (the code Supabase generated). MSG91 then just
// TRANSPORTS that code; it does NOT generate or verify it. Supabase still owns
// generation + verifyOtp — this function stays pure delivery.
const MSG91_OTP_URL = 'https://control.msg91.com/api/v5/otp'

interface SendSmsPayload {
  user: { phone: string }
  sms: { otp: string }
}

// DLT template "OTP_Verification" (id 6a2bb905adfd4020a3007155):
//   "##OTP## is the OTP for Arke Scholars Account Verification.
//    Ref ID ##uniqueID## -Arke Scholars"
// On the /otp route MSG91 fills ##OTP## from the `otp` param; ##uniqueID## is
// left blank (not needed for delivery).
Deno.serve(async (req) => {
  const hookSecret = Deno.env.get('SEND_SMS_HOOK_SECRET')
  const authkey = Deno.env.get('MSG91_AUTHKEY')
  const templateId = Deno.env.get('MSG91_OTP_TEMPLATE_ID')

  if (!hookSecret || !authkey || !templateId) {
    console.error('send-sms-otp: missing required env', {
      hasHookSecret: Boolean(hookSecret),
      hasAuthkey: Boolean(authkey),
      hasTemplateId: Boolean(templateId),
    })
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // 1. Read raw body (signature is computed over the exact bytes).
  const rawBody = await req.text()

  // 2. Verify the Standard Webhooks signature. The secret is stored as
  //    "v1,whsec_<base64>"; standardwebhooks wants just the base64 part.
  const headers = Object.fromEntries(req.headers)
  let payload: SendSmsPayload
  try {
    const wh = new Webhook(hookSecret.replace('v1,whsec_', ''))
    payload = wh.verify(rawBody, headers) as SendSmsPayload
  } catch (err) {
    console.error('send-sms-otp: signature verification failed', String(err))
    return new Response(
      JSON.stringify({ error: 'Invalid signature' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const otp = payload.sms?.otp
  // MSG91 wants a bare-digit "919XXXXXXXXX" (country code, no "+", no spaces).
  // Strip every non-digit so "+91 93524..." / "+919352..." all become 9193524...
  const mobile = payload.user?.phone?.replace(/\D/g, '')

  if (!otp || !mobile) {
    console.error('send-sms-otp: payload missing otp or phone')
    return new Response(
      JSON.stringify({ error: 'Malformed hook payload' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // 3. Relay to MSG91 send-OTP. Params go on the query string (authkey, mobile,
  //    template_id, and our otp) exactly like MSG91's working curl; body is an
  //    empty JSON object. ##uniqueID## in the template renders to nothing on
  //    this route and is not required for delivery, so we don't send it.
  //
  //    otp_expiry=1 (minute): the /otp endpoint keeps one OTP "active" per
  //    number for the expiry window and SILENTLY suppresses resends during it
  //    (returns success, no SMS). Supabase mints a fresh OTP every request, so
  //    we set the shortest window MSG91 allows to minimise that dead time.
  const url = `${MSG91_OTP_URL}?${new URLSearchParams({
    authkey,
    template_id: templateId,
    mobile,
    otp,
    otp_expiry: '1',
  }).toString()}`

  let msg91Status = 0
  let msg91Body = ''
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: '{}',
    })
    msg91Status = res.status
    msg91Body = await res.text()
    console.log('send-sms-otp: MSG91 response', { msg91Status, msg91Body })
  } catch (err) {
    console.error('send-sms-otp: MSG91 request threw', String(err))
    return new Response(
      JSON.stringify({ error: 'SMS provider unreachable' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // MSG91 returns HTTP 200 even for some logical errors, signalling failure via
  // a JSON body of { type: "error", message: "..." }. Treat either a non-2xx
  // status or a "type":"error" body as a failure so Supabase surfaces it to the
  // user (the login UI shows error.message as a toast).
  const looksLikeError =
    msg91Status < 200 ||
    msg91Status >= 300 ||
    /"type"\s*:\s*"error"/i.test(msg91Body)

  if (looksLikeError) {
    console.error('send-sms-otp: MSG91 send failed', { msg91Status, msg91Body })
    return new Response(
      JSON.stringify({ error: 'Failed to send OTP' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // Success — Supabase only needs an empty 200.
  console.log('send-sms-otp: OTP delivered via MSG91', { msg91Status })
  return new Response(
    JSON.stringify({}),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
