// app/api/assignments/[aid]/targets/route.js
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

async function requireTeacherByAid(anonId, aid) {
    const a = await prisma.assignment.findUnique({
        where: { id: aid },
        select: { id: true, classroomId: true, classroom: { select: { ownerAnon: true } } },
    });
    if (!a) return { ok: false, status: 404, error: "Not found" };
    if (a.classroom.ownerAnon === anonId) return { ok: true, classroomId: a.classroomId };
    const teacherRow = await prisma.studentclassroom.findFirst({
        where: { classroomId: a.classroomId, anonId, role: "teacher" },
        select: { id: true },
    });
    if (!teacherRow) return { ok: false, status: 403, error: "Forbidden" };
    return { ok: true, classroomId: a.classroomId };
}

export async function POST(req, { params }) {
    const aid = Number(params?.aid);
    if (!Number.isFinite(aid)) return Response.json({ ok: false, error: "Bad id" }, { status: 400 });

    const cs = await cookies();
    const me = cs.get("learnloomId")?.value;
    if (!me) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const auth = await requireTeacherByAid(me, aid);
    if (!auth.ok) return Response.json({ ok: false, error: auth.error }, { status: auth.status });

    const body = await req.json().catch(() => ({}));
    const { targets = "ALL", overrides = {} } = body || {};
    // wipe old
    await prisma.assignmenttarget.deleteMany({ where: { assignmentId: aid } });

    if (targets === "ALL") {
        await prisma.assignmenttarget.create({
            data: { assignmentId: aid, anonId: null, overridesJson: overrides || {} },
        });
    } else if (Array.isArray(targets) && targets.length) {
        await prisma.assignmenttarget.createMany({
            data: targets.map(anonId => ({ assignmentId: aid, anonId, overridesJson: overrides || {} })),
            skipDuplicates: true,
        });
    }

    return Response.json({ ok: true });
}
