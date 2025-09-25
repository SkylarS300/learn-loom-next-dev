// lib/rateLimit.ts
type Key = string;
const hits = new Map<Key, { n: number; t: number }>();

export function rateLimit(key: Key, limit = 60, windowMs = 60_000) {
    const now = Date.now();
    const cur = hits.get(key);
    if (!cur || now - cur.t > windowMs) {
        hits.set(key, { n: 1, t: now });
        return { ok: true, remaining: limit - 1 };
    }
    if (cur.n >= limit) return { ok: false, remaining: 0 };
    cur.n += 1;
    return { ok: true, remaining: limit - cur.n };
}
