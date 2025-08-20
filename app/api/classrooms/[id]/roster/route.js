// app/api/classrooms/[id]/roster/route.js
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export async function GET(_req, { params }) {
    const classroomId = Number(params?.id);
    if (!Number.isFinite(classroomId)) {
        return Response.json({ ok: false, error: "Bad id" }, { status: 400 });
    }

    const cs = await cookies();
    const me = cs.get("learnloomId")?.value;
    if (!me) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    // teacher / owner only — roster exposes anonIds
    const cls = await prisma.classroom.findUnique({
        where: { id: classroomId },
        select: { ownerAnon: true, id: true },
    });
    if (!cls) return Response.json({ ok: false, error: "Not found" }, { status: 404 });

    const teacherRow = await prisma.studentclassroom.findFirst({
        where: { classroomId, anonId: me, role: "teacher" },
        select: { id: true },
    });
    if (!(cls.ownerAnon === me || teacherRow)) {
        return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const roster = await prisma.studentclassroom.findMany({
        where: { classroomId },
        select: { anonId: true, role: true, displayName: true },
        orderBy: [{ role: "asc" }, { id: "asc" }],
    });

    return Response.json({ ok: true, data: roster });
}
