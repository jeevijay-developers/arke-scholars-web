import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, MailX, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const FN_URL = `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe`;

type Status = "validating" | "ready" | "already" | "invalid" | "submitting" | "done" | "error";

const UnsubscribePage = () => {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [status, setStatus] = useState<Status>("validating");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${FN_URL}?token=${encodeURIComponent(token)}`, {
          headers: { apikey: SUPABASE_KEY },
        });
        const json = await res.json();
        if (cancelled) return;
        if (json.valid === true) setStatus("ready");
        else if (json.valid === false && json.reason === "already_unsubscribed") setStatus("already");
        else setStatus("invalid");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleConfirm = async () => {
    setStatus("submitting");
    try {
      const res = await fetch(FN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
        body: JSON.stringify({ token }),
      });
      const json = await res.json();
      if (json.success || json.reason === "already_unsubscribed") setStatus("done");
      else {
        setErrorMsg(json.error ?? "Could not process your request.");
        setStatus("error");
      }
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Network error");
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-elevated">
        <div className="flex items-center justify-center mb-4">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <MailX className="h-6 w-6 text-primary" />
          </div>
        </div>

        {status === "validating" && (
          <Centered icon={<Loader2 className="h-5 w-5 animate-spin text-primary" />} title="Checking your link…" />
        )}

        {status === "ready" && (
          <>
            <h1 className="text-xl font-black font-display text-center text-foreground">
              Unsubscribe from emails
            </h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              You&apos;ll stop receiving non-essential emails from Arke Scholars. You&apos;ll still get critical
              account messages like password resets.
            </p>
            <button
              onClick={handleConfirm}
              className="mt-6 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Confirm unsubscribe
            </button>
            <button
              onClick={() => navigate("/")}
              className="mt-2 w-full rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-background transition-colors"
            >
              Cancel
            </button>
          </>
        )}

        {status === "submitting" && (
          <Centered icon={<Loader2 className="h-5 w-5 animate-spin text-primary" />} title="Updating your preferences…" />
        )}

        {status === "done" && (
          <Centered
            icon={<CheckCircle2 className="h-6 w-6 text-emerald-500" />}
            title="You&apos;re unsubscribed"
            subtitle="We won&apos;t email you again. You can re-enable emails any time from your settings."
          >
            <button
              onClick={() => navigate("/")}
              className="mt-6 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
            >
              Back to Arke Scholars
            </button>
          </Centered>
        )}

        {status === "already" && (
          <Centered
            icon={<ShieldCheck className="h-6 w-6 text-emerald-500" />}
            title="Already unsubscribed"
            subtitle="This email is already on our suppression list."
          >
            <button
              onClick={() => navigate("/")}
              className="mt-6 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
            >
              Back to Arke Scholars
            </button>
          </Centered>
        )}

        {(status === "invalid" || status === "error") && (
          <Centered
            icon={<AlertTriangle className="h-6 w-6 text-destructive" />}
            title={status === "invalid" ? "Invalid or expired link" : "Something went wrong"}
            subtitle={errorMsg || "Please use the unsubscribe link from a recent email, or contact support."}
          >
            <button
              onClick={() => navigate("/")}
              className="mt-6 w-full rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-background"
            >
              Back to Arke Scholars
            </button>
          </Centered>
        )}
      </div>
    </div>
  );
};

const Centered = ({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) => (
  <div className="text-center">
    <div className="flex justify-center mb-3">{icon}</div>
    <h1 className="text-lg font-black font-display text-foreground">{title}</h1>
    {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
    {children}
  </div>
);

export default UnsubscribePage;
