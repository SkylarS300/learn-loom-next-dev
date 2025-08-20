// app/api/session/code/route.js
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

// --- Simple optional in-memory rate limit (per IP) ---
// Env toggles: ENABLE_CODE_RATELIMIT=true, CODE_RATE_MAX=20, CODE_RATE_WINDOW_MS=60000, CODE_RATE_BLOCK_MS=60000
const ENABLE = process.env.ENABLE_CODE_RATELIMIT === "true";
const MAX = Number(process.env.CODE_RATE_MAX || 20);
const WINDOW_MS = Number(process.env.CODE_RATE_WINDOW_MS || 60_000);
const BLOCK_MS = Number(process.env.CODE_RATE_BLOCK_MS || 60_000);
const g = globalThis;
g.__codeRate = g.__codeRate || new Map();

function getIP(req) {
    const xf = req.headers.get("x-forwarded-for");
    return (xf ? xf.split(",")[0].trim() : "") || req.headers.get("x-real-ip") || "unknown";
}

function normalizeCode(input = "") {
    const raw = String(input || "").toUpperCase().trim();
    // allow users to paste with spaces or without dashes
    const compact = raw.replace(/[^A-Z0-9]/g, "");
    if (compact.length === 11) {
        return `${compact.slice(0, 4)}-${compact.slice(4, 8)}-${compact.slice(8)}`;
    }
    // otherwise keep hyphenated format and strip weird chars
    return raw.replace(/[^A-Z0-9-]/g, "");
}

async function jitter(msMin = 120, msMax = 320) {
    const ms = Math.floor(msMin + Math.random() * (msMax - msMin));
    return new Promise((r) => setTimeout(r, ms));
}

export async function POST(req) {
    const { code: rawCode } = await req.json().catch(() => ({}));
    const code = normalizeCode(rawCode);

    if (!code) {
        return Response.json({ ok: false, error: "Missing code" }, { status: 400 });
    }

    // Rate limit (per IP)
    if (ENABLE) {
        const ip = getIP(req);
        const now = Date.now();
        const bucket = g.__codeRate.get(ip) || { tokens: MAX, resetAt: now + WINDOW_MS, blockedUntil: 0 };
        if (bucket.blockedUntil > now) {
            return Response.json({ ok: false, error: "Too many attempts. Try again later." }, { status: 429 });
        }
        if (bucket.resetAt <= now) {
            bucket.tokens = MAX;
            bucket.resetAt = now + WINDOW_MS;
        }
        g.__codeRate.set(ip, bucket);
    }

    const row = await prisma.userCode.findUnique({
        where: { shortCode: code },
        select: { anonId: true, id: true },
    });

    if (!row) {
        if (ENABLE) {
            const ip = getIP(req);
            const now = Date.now();
            const bucket = g.__codeRate.get(ip);
            if (bucket) {
                bucket.tokens -= 1;
                if (bucket.tokens <= 0) {
                    bucket.blockedUntil = now + BLOCK_MS;
                }
                g.__codeRate.set(ip, bucket);
            }
        }
        await jitter(); // slow down enumeration
        return Response.json({ ok: false, error: "Invalid code" }, { status: 404 });
    }

    await prisma.userCode.update({
        where: { id: row.id },
        data: { lastUsedAt: new Date() },
    });

    // Set the session cookie
    const cs = await cookies();
    cs.set("learnloomId", row.anonId, {
        path: "/",
        httpOnly: false,
        sameSite: "Lax",
        maxAge: 60 * 60 * 24 * 365 * 5,
    });

    return Response.json({ ok: true, data: { anonId: row.anonId } });
}
