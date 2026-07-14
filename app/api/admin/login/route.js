// app/api/admin/login/route.js
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Constant-time string compare, so response timing can't leak how many
// leading characters of SUPPORT_PASS a guess got right.
function tsc(a = "", b = "") {
    const la = Buffer.from(String(a));
    const lb = Buffer.from(String(b));
    // Note: bailing out early on length mismatch is a (much smaller) timing
    // leak in itself, but comparing buffers of different lengths would throw.
    if (la.length !== lb.length) return false;
    return timingSafeEqual(la, lb);
}

export async function POST(req) {
    const { pass } = await req.json().catch(() => ({}));
    const ok = !!process.env.SUPPORT_PASS && tsc(pass, process.env.SUPPORT_PASS);
    if (!ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const res = NextResponse.json({ ok: true });
    // httpOnly, short-lived, prod-secure
    const host = (req.headers.get("host") || "").toLowerCase();
    const useDomain = host.endsWith("learnloom.xyz") ? ".learnloom.xyz" : undefined;
    const isProd = !!useDomain;
    res.cookies.set({
        name: "adminSession",
        value: "1",
        httpOnly: true,
        sameSite: "Lax",
        secure: isProd,
        ...(useDomain ? { domain: useDomain } : {}),
        path: "/",
        maxAge: 60 * 60, // 1 hour
    });
    return res;
}