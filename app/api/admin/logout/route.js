// app/api/admin/logout/route.js
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
    const res = NextResponse.json({ ok: true });
    const host = (req.headers.get("host") || "").toLowerCase();
    const useDomain = host.endsWith("learnloom.xyz") ? ".learnloom.xyz" : undefined;
    const isProd = !!useDomain;
    // clear host
    res.cookies.set({ name: "adminSession", value: "", path: "/", maxAge: 0, sameSite: "Lax" });
    // clear domain
    res.cookies.set({ name: "adminSession", value: "", path: "/", maxAge: 0, sameSite: "Lax", secure: isProd, ...(useDomain ? { domain: useDomain } : {}) });
    return res;
}
