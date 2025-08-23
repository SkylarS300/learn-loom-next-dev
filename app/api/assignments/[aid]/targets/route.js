// app/api/assignments/[aid]/targets/route.js
import prisma from "@/lib/prisma";
import { z } from "zod";
import { getAnonId, jsonOk, jsonErr } from "@/app/api/_util/auth";

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
    if (!Number.isFinite(aid)) return jsonErr("Bad id", 400);

    const me = await getAnonId();
    if (!me) return jsonErr("Unauthorized", 401);

    const auth = await requireTeacherByAid(me, aid);
    if (!auth.ok) return jsonErr(auth.error, auth.status);

    const Body = z.object({
        targets: z.union([z.literal("ALL"), z.array(z.string().min(1)).min(1)]).optional().default("ALL"),
        overrides: z.record(z.unknown()).optional().default({}),
    });
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return jsonErr("Invalid request", 400, { issues: parsed.error.issues });
    const { targets = "ALL", overrides = {} } = parsed.data;
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

    return jsonOk();
}
