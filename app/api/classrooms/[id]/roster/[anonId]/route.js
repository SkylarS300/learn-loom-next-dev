// app/api/classrooms/[id]/roster/[anonId]/route.js
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

// auth helper (copy of the one in GET route)
async function requireTeacher(anonId, classroomId) {
    const cls = await prisma.classroom.findUnique({
        where: { id: classroomId },
        select: { id: true, ownerAnon: true },
    });
    if (!cls) return { ok: false, status: 404, error: "Not found" };
    if (cls.ownerAnon === anonId) return { ok: true, cls };
    const teacherRow = await prisma.studentclassroom.findFirst({
        where: { classroomId, anonId, role: "teacher" },
        select: { id: true },
    });
    if (!teacherRow) return { ok: false, status: 403, error: "Forbidden" };
    return { ok: true, cls };
}

// PATCH /api/classrooms/:id/roster/:anonId { displayName }
export async function PATCH(req, { params }) {
    const classroomId = Number(params?.id);
    const anonId = params?.anonId;
    if (!Number.isFinite(classroomId) || !anonId) {
        return Response.json({ ok: false, error: "Bad params" }, { status: 400 });
    }

    const cs = await cookies();
    const me = cs.get("learnloomId")?.value;
    if (!me) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const auth = await requireTeacher(me, classroomId);
    if (!auth.ok) return Response.json({ ok: false, error: auth.error }, { status: auth.status });

    const { displayName } = await req.json().catch(() => ({}));
    const cleaned = typeof displayName === "string" ? displayName.trim() : "";

    const membership = await prisma.studentclassroom.findFirst({
        where: { classroomId, anonId },
        select: { id: true, role: true },
    });
    if (!membership) return Response.json({ ok: false, error: "Not in class" }, { status: 404 });
    // allow editing display name for students only (teacher names are not managed here)
    if (membership.role === "teacher") {
        return Response.json({ ok: false, error: "Cannot edit teacher here" }, { status: 400 });
    }

    const updated = await prisma.studentclassroom.update({
        where: { id: membership.id },
        data: { displayName: cleaned || null },
        select: { anonId: true, displayName: true },
    });

    return Response.json({ ok: true, data: updated });
}

// DELETE /api/classrooms/:id/roster/:anonId
export async function DELETE(_req, { params }) {
    const classroomId = Number(params?.id);
    const anonId = params?.anonId;
    if (!Number.isFinite(classroomId) || !anonId) {
        return Response.json({ ok: false, error: "Bad params" }, { status: 400 });
    }

    const cs = await cookies();
    const me = cs.get("learnloomId")?.value;
    if (!me) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const auth = await requireTeacher(me, classroomId);
    if (!auth.ok) return Response.json({ ok: false, error: auth.error }, { status: auth.status });

    // don't remove teachers with this route
    const membership = await prisma.studentclassroom.findFirst({
        where: { classroomId, anonId },
        select: { id: true, role: true },
    });
    if (!membership) return Response.json({ ok: false, error: "Not in class" }, { status: 404 });
    if (membership.role === "teacher") {
        return Response.json({ ok: false, error: "Cannot remove a teacher via this action" }, { status: 400 });
    }

    await prisma.studentclassroom.delete({ where: { id: membership.id } });
    return Response.json({ ok: true });
}
