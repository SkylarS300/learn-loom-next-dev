// lib/rum.js
export function track(event, params = {}) {
    if (typeof window === "undefined") return;
    const payload = { ...params, ts: Math.round(performance.now()) };
    try {
        if (typeof window.gtag === "function") {
            window.gtag("event", event, payload);
            return;
        }
        if (Array.isArray(window.dataLayer)) {
            window.dataLayer.push({ event, ...payload });
            return;
        }
    } catch { }
    if (process.env.NODE_ENV !== "production") {
        // dev fallback
        // eslint-disable-next-line no-console
        console.log("[RUM]", event, payload);
    }
}
