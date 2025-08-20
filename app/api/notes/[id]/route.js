// app/api/notes/[id]/route.js
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

function unauthorized() {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

export async function PATCH(req, ctx) {
    const cookieStore = await cookies();
    const anonId = cookieStore.get("learnloomId")?.value;
    if (!anonId) return unauthorized();
    const id = (ctx.params)?.id; // quiets the Next warning
    if (!id) return Response.json({ ok: false, error: "Missing id" }, { status: 400 });

    const payload = await req.json().catch(() => ({}));
    const data = {};
    if (typeof payload.body === "string") {
        if (!payload.body.trim()) return Response.json({ ok: false, error: "Empty body" }, { status: 400 });
        if (payload.body.length > 2000) return Response.json({ ok: false, error: "Note too long" }, { status: 400 });
        data.body = payload.body.trim();
    }
    if (Array.isArray(payload.tags)) {
        data.tagsJson = payload.tags.map((t) => String(t).slice(0, 24)).filter(Boolean).slice(0, 10);
    }
    if (payload.color !== undefined) data.color = payload.color || null;
    if (payload.isBookmark !== undefined) data.isBookmark = !!payload.isBookmark;

    // Atomic ownership check
    const res = await prisma.note.updateMany({
        where: { id, anonId },
        data,
    });
    if (!res.count) return Response.json({ ok: false, error: "Not found" }, { status: 404 });
    const fresh = await prisma.note.findFirst({ where: { id, anonId } });
    return Response.json({ ok: true, data: fresh });
}

export async function DELETE(_req, ctx) {
    const cookieStore = await cookies();
    const anonId = cookieStore.get("learnloomId")?.value;
    if (!anonId) return unauthorized();
    const id = (ctx.params)?.id; // quiets the Next warning
    if (!id) return Response.json({ ok: false, error: "Missing id" }, { status: 400 });

    // enforce ownership
    const del = await prisma.note.deleteMany({ where: { id, anonId } });
    if (!del.count) return Response.json({ ok: false, error: "Not found" }, { status: 404 });
    return Response.json({ ok: true });
}
