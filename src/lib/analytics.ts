declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export function trackPageView(path: string, title: string) {
  if (typeof window.gtag === "function") {
    window.gtag("event", "page_view", {
      page_path: path,
      page_title: title,
    });
  }
}

export function trackEvent(event: string, params?: Record<string, unknown>) {
  if (typeof window.gtag === "function") {
    window.gtag("event", event, params);
  }
}
