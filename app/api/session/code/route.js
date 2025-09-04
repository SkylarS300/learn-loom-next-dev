// app/api/session/code/route.js
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";        // ensure Node runtime
export const dynamic = "force-dynamic"; // avoid any caching

// --- Simple optional in-memory rate limit (per IP) ---
const ENABLE =
    process.env.ENABLE_CODE_RATELIMIT === "true" ||
    process.env.CODE_RATE_LIMIT === "1";
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
    const compact = raw.replace(/[^A-Z0-9]/g, "");
    if (compact.length === 11) {
        return `${compact.slice(0, 4)}-${compact.slice(4, 8)}-${compact.slice(8)}`;
    }
    return raw.replace(/[^A-Z0-9-]/g, "");
}

async function jitter(msMin = 120, msMax = 320) {
    const ms = Math.floor(msMin + Math.random() * (msMax - msMin));
    return new Promise((r) => setTimeout(r, ms));
}

export async function POST(req) {
    let code;
    try {
        const body = await req.json().catch(() => ({}));
        code = normalizeCode(body?.code || "");
    } catch {
        code = "";
    }

    if (!code) {
        return NextResponse.json({ ok: false, error: "Missing code" }, { status: 400 });
    }

    // Rate limit (optional)
    if (ENABLE) {
        const ip = getIP(req);
        const now = Date.now();
        const bucket = g.__codeRate.get(ip) || { tokens: MAX, resetAt: now + WINDOW_MS, blockedUntil: 0 };
        if (bucket.blockedUntil > now) {
            return NextResponse.json({ ok: false, error: "Too many attempts. Try again later." }, { status: 429 });
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
        await jitter();
        return NextResponse.json({ ok: false, error: "Invalid code" }, { status: 404 });
    }

    await prisma.userCode.update({
        where: { id: row.id },
        data: { lastUsedAt: new Date() },
    });

    // Create the response and SET THE COOKIE ON THAT RESPONSE
    const res = NextResponse.json({ ok: true, data: { anonId: row.anonId } }, { status: 200 });

    // Decide cookie domain dynamically so dev/preview work too
    const host = (req.headers.get("host") || "").toLowerCase();
    const useDomain =
        host.endsWith("learnloom.xyz") ? ".learnloom.xyz" : undefined; // omit for localhost/preview

    //  Be explicit: domain + secure + Lax (capitalized in header) + long max-age
    res.cookies.set({
        name: "learnloomId",
        value: row.anonId,
        path: "/",
        httpOnly: false,           // OK to leave false since you also read it client-side
        secure: true,
        sameSite: "lax",           // Next will serialize header as SameSite=Lax
        ...(useDomain ? { domain: useDomain } : {}), // only set in prod
        maxAge: 60 * 60 * 24 * 365 * 5,
    });

    return res;
}
