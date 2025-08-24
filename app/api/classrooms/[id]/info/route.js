// app/api/classrooms/[id]/info/route.js
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export async function GET(_req, ctx) {
    const classId = Number((await ctx.params)?.id);
    const cs = await cookies();
    const me = cs.get("learnloomId")?.value;
    if (!me) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    if (!Number.isFinite(classId)) return Response.json({ ok: false, error: "Bad id" }, { status: 400 });

    const cls = await prisma.classroom.findUnique({
        where: { id: classId },
        select: { id: true, name: true, code: true, ownerAnon: true },
    });
    if (!cls) return Response.json({ ok: false, error: "Not found" }, { status: 404 });

    const membership = await prisma.studentclassroom.findFirst({
        where: { classroomId: classId, anonId: me },
        select: { role: true, displayName: true },
    });

    if (!(membership || me === cls.ownerAnon)) {
        return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const role = me === cls.ownerAnon ? "teacher" : (membership?.role || "student");

    return Response.json({
        ok: true,
        data: {
            id: cls.id,
            name: cls.name,
            code: cls.code,
            role,
            myAnonId: me,
            myDisplayName: membership?.displayName ?? null,
        },
    }, { status: 200 });
}
