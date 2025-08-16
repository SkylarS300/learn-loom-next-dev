// app/api/notes/[id]/route.js
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

function unauthorized() {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

export async function PATCH(req, { params }) {
    const cookieStore = await cookies();
    const anonId = cookieStore.get("learnloomId")?.value;
    if (!anonId) return unauthorized();
    const id = params?.id;
    if (!id) return Response.json({ ok: false, error: "Missing id" }, { status: 400 });

    const payload = await req.json().catch(() => ({}));
    const data = {};
    if (typeof payload.body === "string") {
        if (!payload.body.trim()) return Response.json({ ok: false, error: "Empty body" }, { status: 400 });
        if (payload.body.length > 2000) return Response.json({ ok: false, error: "Note too long" }, { status: 400 });
        data.body = payload.body.trim();
    }
    if (Array.isArray(payload.tags)) {
        data.tags = payload.tags.map((t) => String(t).slice(0, 24)).filter(Boolean).slice(0, 10);
    }
    if (payload.color !== undefined) data.color = payload.color || null;
    if (payload.isBookmark !== undefined) data.isBookmark = !!payload.isBookmark;

    const updated = await prisma.note.update({
        where: { id },
        data,
    }).catch(async (e) => {
        // ownership check – ensure anonId matches
        const row = await prisma.note.findUnique({ where: { id } });
        if (!row || row.anonId !== anonId) {
            return null;
        }
        throw e;
    });
    if (!updated) return Response.json({ ok: false, error: "Not found" }, { status: 404 });
    return Response.json({ ok: true, data: updated });
}

export async function DELETE(_req, { params }) {
    const cookieStore = await cookies();
    const anonId = cookieStore.get("learnloomId")?.value;
    if (!anonId) return unauthorized();
    const id = params?.id;
    if (!id) return Response.json({ ok: false, error: "Missing id" }, { status: 400 });

    // enforce ownership
    const row = await prisma.note.findUnique({ where: { id } });
    if (!row || row.anonId !== anonId) {
        return Response.json({ ok: false, error: "Not found" }, { status: 404 });
    }
    await prisma.note.delete({ where: { id } });
    return Response.json({ ok: true });
}
