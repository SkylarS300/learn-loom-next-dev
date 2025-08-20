// app/api/session/code/route.js
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

// Simple, in-memory IP rate limit (optional, toggle with CODE_LOGIN_RATELIMIT=off)
const RL_ON = process.env.CODE_LOGIN_RATELIMIT !== "off";
const WINDOW_MS = 10 * 60 * 1000; // 10 min
const MAX_ATTEMPTS = Number(process.env.CODE_LOGIN_RATELIMIT_MAX || 30);
const bucket = (globalThis.__codeBuckets ||= new Map()); // { ip -> {count, ts} }

function getIp(req) {
    const h = req.headers;
    const fwd = h.get("x-forwarded-for");
    if (fwd) return fwd.split(",")[0].trim();
    const real = h.get("x-real-ip");
    if (real) return real.trim();
    return "anon";
}

export async function POST(req) {
    const ip = getIp(req);
    if (RL_ON) {
        const now = Date.now();
        const b = bucket.get(ip) || { count: 0, ts: now };
        if (now - b.ts > WINDOW_MS) { b.count = 0; b.ts = now; }
        b.count += 1;
        bucket.set(ip, b);
        if (b.count > MAX_ATTEMPTS) {
            return Response.json({ ok: false, error: "Too many attempts, try later" }, { status: 429 });
        }
    }

    const body = await req.json().catch(() => ({}));
    let raw = String(body?.code || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); // strip hyphens/spaces
    if (!raw) {
        return Response.json({ ok: false, error: "Missing code" }, { status: 400 });
    }
    // Re-dash to canonical 4-4-3 if length matches
    if (raw.length === 11) raw = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
    const code = raw.trim();

    if (!code) {
        return Response.json({ ok: false, error: "Missing code" }, { status: 400 });
    }

    const row = await prisma.userCode.findUnique({
        where: { shortCode: code },
        select: { anonId: true, id: true },
    });

    if (!row) {
        return Response.json({ ok: false, error: "Invalid code" }, { status: 404 });
    }

    await prisma.userCode.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } });

    // Set the session cookie
    const cs = await cookies();
    cs.set("learnloomId", row.anonId, {
        path: "/",
        httpOnly: false,
        sameSite: "Lax",
        maxAge: 60 * 60 * 24 * 365 * 5, // 5 years
    });

    if (RL_ON) bucket.delete(ip); // successful login clears the bucket

    return Response.json({ ok: true, data: { anonId: row.anonId } });
}
