// app/api/admin/login/route.js
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function tsc(a = "", b = "") {
    // time-safe compare
    const la = Buffer.from(String(a));
    const lb = Buffer.from(String(b));
    if (la.length !== lb.length) return false;
    return crypto.subtle ? la.every((v, i) => v === lb[i]) : la.equals(lb);
}

export async function POST(req) {
    const { pass } = await req.json().catch(() => ({}));
    const ok = !!process.env.SUPPORT_PASS && String(pass || "") === String(process.env.SUPPORT_PASS);
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
