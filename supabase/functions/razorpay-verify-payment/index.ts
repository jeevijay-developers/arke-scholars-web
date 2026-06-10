import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  keySecret: string
): Promise<boolean> {
  const message = `${orderId}|${paymentId}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(keySecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  const expectedHex = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return expectedHex === signature;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Get the calling user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const razorpayPaymentId = String(body.razorpayPaymentId ?? "");
    const razorpayOrderId   = String(body.razorpayOrderId ?? "");
    const razorpaySignature = String(body.razorpaySignature ?? "");
    // courseId from body is validated against the order on Razorpay's side below
    const courseId = String(body.courseId ?? "");

    if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature || !courseId) {
      return new Response(JSON.stringify({ error: "Missing required payment fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const keyId     = Deno.env.get("RAZORPAY_KEY_ID");
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!keyId || !keySecret) {
      return new Response(JSON.stringify({ error: "Payment gateway not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Verify HMAC signature — confirms the callback is genuine Razorpay
    const isValid = await verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature, keySecret);
    if (!isValid) {
      console.error("Razorpay signature verification failed", { razorpayOrderId, razorpayPaymentId });
      return new Response(JSON.stringify({ error: "Payment verification failed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rzpAuth = `Basic ${btoa(`${keyId}:${keySecret}`)}`;

    // Step 2: Fetch the order from Razorpay to read the authoritative course_id from notes
    const orderResp = await fetch(`https://api.razorpay.com/v1/orders/${razorpayOrderId}`, {
      headers: { Authorization: rzpAuth },
    });
    if (!orderResp.ok) {
      console.error("Failed to fetch Razorpay order", razorpayOrderId, await orderResp.text());
      return new Response(JSON.stringify({ error: "Could not verify payment order" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const rzpOrder = await orderResp.json() as { notes?: Record<string, string>; currency?: string };

    // Step 3: Validate the course_id in the order matches what the client claims
    const orderedCourseId = String(rzpOrder.notes?.course_id ?? "");
    if (!orderedCourseId || orderedCourseId !== courseId) {
      console.error("Course ID mismatch", { body_courseId: courseId, order_courseId: orderedCourseId });
      return new Response(JSON.stringify({ error: "Payment verification failed: course mismatch" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 4: Look up the authoritative course price from DB
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: course, error: courseErr } = await admin
      .from("courses")
      .select("id, name, sale_price, is_course_free")
      .eq("id", orderedCourseId)
      .maybeSingle();
    if (courseErr || !course) {
      return new Response(JSON.stringify({ error: "Course not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 5: Fetch payments on this order to confirm a captured payment exists
    const paymentsResp = await fetch(`https://api.razorpay.com/v1/orders/${razorpayOrderId}/payments`, {
      headers: { Authorization: rzpAuth },
    });
    if (!paymentsResp.ok) {
      console.error("Failed to fetch payments for order", razorpayOrderId);
      return new Response(JSON.stringify({ error: "Could not verify payment capture" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const paymentsData = await paymentsResp.json() as {
      items?: Array<{ id: string; status: string; amount: number }>;
    };
    const capturedPayment = (paymentsData.items ?? []).find(
      (p) => p.id === razorpayPaymentId && p.status === "captured"
    );
    if (!capturedPayment) {
      console.error("Payment not captured", { razorpayPaymentId, items: paymentsData.items });
      return new Response(JSON.stringify({ error: "Payment not captured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 6: Validate captured amount matches DB price (no underpayment).
    // Free courses bypass the amount check entirely.
    const expectedPaise = Math.round(Number((course as any).sale_price ?? 0) * 100);
    if (!((course as any).is_course_free) && capturedPayment.amount < expectedPaise) {
      console.error("Payment amount insufficient", { paid: capturedPayment.amount, expected: expectedPaise });
      return new Response(JSON.stringify({ error: "Payment amount does not match course price" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // All checks passed — use server-derived values, not client-supplied ones
    const courseName = course.name;
    const amountINR  = capturedPayment.amount / 100;
    const currency   = String(rzpOrder.currency ?? "INR");

    // Record the payment
    const now = new Date().toISOString();
    const { data: paymentRecord, error: paymentInsertError } = await admin
      .from("payments")
      .insert({
        user_id: user.id,
        student_name: user.user_metadata?.full_name ?? user.email ?? "",
        course_name: courseName,
        amount: amountINR,
        currency,
        gateway: "razorpay",
        external_id: razorpayPaymentId,
        status: "success",
        metadata: { order_id: razorpayOrderId, course_id: courseId },
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();
    if (paymentInsertError) throw paymentInsertError;

    // Create or reactivate enrollment, linking to this payment
    const { error: enrollError } = await admin
      .from("enrollments")
      .upsert(
        { user_id: user.id, course_id: courseId, is_active: true, last_accessed_at: now, payment_id: paymentRecord.id },
        { onConflict: "user_id,course_id", ignoreDuplicates: false }
      );
    if (enrollError) {
      console.error("Enrollment upsert error", enrollError);
    }

    // In-app notification
    await admin.from("notifications").insert({
      user_id: user.id,
      title: "Payment successful!",
      body: `You're now enrolled in ${courseName}. Start learning anytime.`,
      type: "course",
      link: "/my-courses",
    });

    // Payment receipt email (fire-and-forget)
    if (user.email) {
      const amountFormatted = currency === "AED"
        ? `AED ${amountINR.toLocaleString()}`
        : `₹${amountINR.toLocaleString()}`;
      const paidAtFormatted = new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      });
      fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          templateName: "payment-receipt",
          recipientEmail: user.email,
          idempotencyKey: `payment-${razorpayPaymentId}`,
          templateData: {
            customerName: user.user_metadata?.full_name || "Learner",
            itemName: courseName,
            amount: amountFormatted,
            paymentMethod: "Razorpay",
            transactionId: razorpayPaymentId,
            paidAt: paidAtFormatted,
          },
        }),
      }).catch((err) => console.error("Email dispatch error", err));
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("razorpay-verify-payment error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
