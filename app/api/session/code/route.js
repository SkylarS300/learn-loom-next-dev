// app/api/session/code/route.js
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function POST(req) {
    const body = await req.json().catch(() => ({}));
    const raw = (body?.code || "").toUpperCase().replace(/[^A-Z0-9-]/g, "");
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

    return Response.json({ ok: true, data: { anonId: row.anonId } });
}
