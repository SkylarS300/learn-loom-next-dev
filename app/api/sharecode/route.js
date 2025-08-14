import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// Normalize a code: letters/digits only, trim
function norm(code) {
    return String(code || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export async function GET() {
    const c = await cookies();
    try {
        const list = JSON.parse(c.get("shareCodes")?.value || "[]");
        return NextResponse.json({ ok: true, data: Array.isArray(list) ? list : [] });
    } catch {
        return NextResponse.json({ ok: true, data: [] });
    }
}

export async function POST(req) {
    const body = await req.json().catch(() => ({}));
    const code = norm(body.code);
    if (!code) return NextResponse.json({ ok: false, error: "Invalid code" }, { status: 422 });

    const c = await cookies();
    let list = [];
    try { list = JSON.parse(c.get("shareCodes")?.value || "[]"); } catch { }
    if (!Array.isArray(list)) list = [];
    if (!list.includes(code)) list.push(code);

    const res = NextResponse.json({ ok: true, data: list });
    res.cookies.set("shareCodes", JSON.stringify(list), {
        httpOnly: true,
        sameSite: "Lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 90, // 90 days
    });
    return res;
}

export async function DELETE(req) {
    const url = new URL(req.url);
    const raw = url.searchParams.get("code");
    const code = norm(raw);
    const c = await cookies();
    let list = [];
    try { list = JSON.parse(c.get("shareCodes")?.value || "[]"); } catch { }
    if (!Array.isArray(list)) list = [];
    const updated = code ? list.filter((x) => x !== code) : [];

    const res = NextResponse.json({ ok: true, data: updated });
    res.cookies.set("shareCodes", JSON.stringify(updated), {
        httpOnly: true,
        sameSite: "Lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 90,
    });
    return res;
}
