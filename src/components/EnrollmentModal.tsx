import { useEffect, useRef, useState } from "react";
import { X, PartyPopper, AlertCircle, Loader2, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useAppStore } from "@/store/useAppStore";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open(): void };
  }
}

interface EnrollmentModalProps {
  open: boolean;
  onClose: () => void;
  courseId: string;
  courseName: string;
  coursePrice: number;
  onEnrolled?: () => void;
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

const EnrollmentModal = ({ open, onClose, courseId, courseName, coursePrice, onEnrolled }: EnrollmentModalProps) => {
  const { user } = useAuth();
  const [step, setStep] = useState<"checkout" | "loading" | "success" | "error">("checkout");
  const [errorMsg, setErrorMsg] = useState("");
  const [isStaff, setIsStaff] = useState(false);
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    return () => { activeRef.current = false; };
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        const roles = (data ?? []).map((r) => r.role);
        setIsStaff(roles.includes("admin") || roles.includes("super_admin"));
      });
  }, [user]);

  if (!open) return null;

  const currency = "INR";
  const displayAmount = `₹${coursePrice.toLocaleString()}`;
  const amountForGateway = coursePrice;

  const close = () => {
    setStep("checkout");
    setErrorMsg("");
    onClose();
  };

  const handlePayWithRazorpay = async () => {
    if (!user) return;
    setStep("loading");

    const loaded = await loadRazorpayScript();
    if (!loaded) {
      setErrorMsg("Could not load payment gateway. Check your internet connection.");
      setStep("error");
      return;
    }

    // Get auth token for edge function calls
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setErrorMsg("Session expired. Please sign in again.");
      setStep("error");
      return;
    }

    // Create Razorpay order on the server
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const orderResp = await fetch(`${supabaseUrl}/functions/v1/razorpay-create-order`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, courseName, amount: amountForGateway, currency }),
    });

    if (!orderResp.ok) {
      const err = await orderResp.json().catch(() => ({}));
      setErrorMsg((err as { error?: string }).error || "Could not create payment order.");
      setStep("error");
      return;
    }

    const { orderId, amount, keyId } = (await orderResp.json()) as {
      orderId: string;
      amount: number;
      currency: string;
      keyId: string;
    };

    // Open Razorpay checkout popup
    const rzp = new window.Razorpay({
      key: keyId,
      amount,
      currency,
      name: "Arke Scholars",
      description: courseName,
      order_id: orderId,
      prefill: {
        email: user.email ?? "",
        name: user.user_metadata?.full_name ?? "",
      },
      theme: { color: "#C99A2E" },
      modal: {
        ondismiss: () => {
          if (activeRef.current) setStep("checkout");
        },
      },
      handler: async (response: {
        razorpay_payment_id: string;
        razorpay_order_id: string;
        razorpay_signature: string;
      }) => {
        // Verify payment server-side and create enrollment
        const verifyResp = await fetch(`${supabaseUrl}/functions/v1/razorpay-verify-payment`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            razorpayPaymentId: response.razorpay_payment_id,
            razorpayOrderId: response.razorpay_order_id,
            razorpaySignature: response.razorpay_signature,
            courseId,
            courseName,
            amount: amountForGateway,
            currency,
          }),
        });

        if (!verifyResp.ok) {
          const err = await verifyResp.json().catch(() => ({}));
          if (activeRef.current) {
            setErrorMsg((err as { error?: string }).error || "Payment verification failed.");
            setStep("error");
          }
          return;
        }

        if (activeRef.current) setStep("success");
      },
    });

    rzp.open();
  };

  const handleStaffDemoEnroll = async () => {
    if (!user) return;
    setStep("loading");
    const { error } = await supabase
      .from("enrollments")
      .insert({ user_id: user.id, course_id: courseId, is_active: true, last_accessed_at: new Date().toISOString() });
    if (error && !error.message.includes("duplicate")) {
      setErrorMsg(error.message);
      setStep("error");
      return;
    }
    await supabase.from("notifications").insert({
      user_id: user.id,
      title: "You're enrolled (staff demo)",
      body: `Welcome to ${courseName}.`,
      type: "course",
      link: `/my-courses`,
    });
    setStep("success");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={step === "loading" ? undefined : close} />
      <div className="relative w-full max-w-md rounded-2xl bg-card shadow-xl border border-border overflow-y-auto max-h-[90vh]">
        {step !== "loading" && (
          <button onClick={close} className="absolute right-3 top-3 rounded-lg p-1.5 text-muted-foreground hover:bg-background z-10">
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Checkout step */}
        {step === "checkout" && (
          <div className="p-6 space-y-5">
            <div className="text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mx-auto mb-3">
                <CreditCard className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Complete Your Enrollment</h2>
              <p className="text-xs text-muted-foreground mt-1">{courseName}</p>
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-4 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Amount due</span>
              <span className="text-xl font-black text-foreground">{displayAmount}</span>
            </div>

            <button
              onClick={handlePayWithRazorpay}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            >
              <CreditCard className="h-4 w-4" />
              Pay with Razorpay (UPI / Card / Netbanking)
            </button>

            {isStaff && (
              <button
                onClick={handleStaffDemoEnroll}
                className="w-full rounded-lg border border-dashed border-primary/40 px-4 py-2 text-[11px] font-medium text-primary flex items-center justify-center gap-2"
              >
                Staff: Demo enroll without payment
              </button>
            )}

            <p className="text-center text-[10px] text-muted-foreground">
              Secured by Razorpay · UPI, Debit/Credit Cards, Netbanking, EMI
            </p>
          </div>
        )}

        {/* Loading */}
        {step === "loading" && (
          <div className="p-12 text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Processing payment…</p>
          </div>
        )}

        {/* Success */}
        {step === "success" && (
          <div className="p-8 text-center space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary/10 mx-auto">
              <PartyPopper className="h-8 w-8 text-secondary" />
            </div>
            <h2 className="text-lg font-bold text-foreground">You're Enrolled!</h2>
            <p className="text-sm text-muted-foreground">{courseName}</p>
            <p className="text-xs text-muted-foreground">A receipt has been sent to your email.</p>
            <button
              onClick={() => { onEnrolled?.(); close(); }}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Start Learning
            </button>
          </div>
        )}

        {/* Error */}
        {step === "error" && (
          <div className="p-8 text-center space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mx-auto">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Payment Failed</h2>
            <p className="text-sm text-muted-foreground">{errorMsg || "Something went wrong. Please try again."}</p>
            <button onClick={() => { setStep("checkout"); setErrorMsg(""); }} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnrollmentModal;
