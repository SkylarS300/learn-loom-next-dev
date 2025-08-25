// app/api/classrooms/[id]/route.js
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export async function POST(req) {
    const cs = await cookies();
    const anonId = cs.get("learnloomId")?.value;
    if (!anonId) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const { code = "", displayName = "" } = await req.json();
    const cls = await prisma.classroom.findFirst({ where: { code: String(code).trim().toUpperCase() } });
    if (!cls) return Response.json({ ok: false, error: "Invalid code" }, { status: 404 });

    // Always join as student. Role elevation happens inside the classroom by the owner.
    const membership = await prisma.studentclassroom.upsert({
        where: { classroomId_anonId: { classroomId: cls.id, anonId } },
        create: { classroomId: cls.id, anonId, role: "student", displayName: displayName?.trim() || null },
        update: { displayName: displayName?.trim() || null },
        select: { classroomId: true },
    });

    return Response.json({ ok: true, data: membership });
}


// DELETE /api/classrooms/[id] — owner only
export async function DELETE(_req, ctx) {
    const { id } = await ctx.params;
    const classId = Number(id);
    if (!Number.isFinite(classId)) {
        return Response.json({ ok: false, error: "Bad id" }, { status: 400 });
    }

    const cs = await cookies();
    const anonId = cs.get("learnloomId")?.value;
    if (!anonId) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const cls = await prisma.classroom.findUnique({
        where: { id: classId },
        select: { id: true, ownerAnon: true },
    });
    if (!cls) return Response.json({ ok: false, error: "Not found" }, { status: 404 });
    if (cls.ownerAnon !== anonId) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

    // Clean up dependent data first to avoid FK errors
    const assignmentIds = (await prisma.assignment.findMany({
        where: { classroomId: classId },
        select: { id: true },
    })).map(a => a.id);

    await prisma.$transaction([
        prisma.assignmentcompletion.deleteMany({ where: { assignmentId: { in: assignmentIds } } }),
        prisma.assignmenttarget.deleteMany({ where: { assignmentId: { in: assignmentIds } } }),
        prisma.assignment.deleteMany({ where: { classroomId: classId } }),
        prisma.studentclassroom.deleteMany({ where: { classroomId: classId } }),
        prisma.classroom.delete({ where: { id: classId } }),
    ]);

    return Response.json({ ok: true });
}

