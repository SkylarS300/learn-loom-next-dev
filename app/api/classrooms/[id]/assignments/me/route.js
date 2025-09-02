// app/api/classrooms/[id]/assignments/me/route.js
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
export const dynamic = "force-dynamic";

export async function GET(req, ctx) {
    const cs = await cookies();
    const me = cs.get("learnloomId")?.value;
    if (!me) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const classId = Number((await ctx.params)?.id);
    if (!Number.isFinite(classId)) return Response.json({ ok: false, error: "Bad id" }, { status: 400 });

    // Must be a member of this classroom (student role for this feed)
    const member = await prisma.studentclassroom.findFirst({
        where: { classroomId: classId, anonId: me },
        select: { role: true, classroom: { select: { name: true } } },
    });
    if (!member) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
    if ((member.role || "student") === "teacher") {
        // Teacher shouldn't see this feed
        return Response.json({ ok: true, data: [] }, { headers: { "Cache-Control": "no-store" } });
    }

    const url = new URL(req.url);
    const now = new Date();
    const horizonDays = Math.max(1, Number(url.searchParams.get("days") || 30));
    const to = new Date(now.getTime() + horizonDays * 86400000);

    // Assignments in this class targeting me (ALL or explicit)
    const asns = await prisma.assignment.findMany({
        where: {
            classroomId: classId,
            OR: [{ targets: { some: { anonId: me } } }, { targets: { some: { anonId: null } } }],
            OR: [{ dueDate: null }, { dueDate: { lte: to } }],
        },
        orderBy: { dueDate: "asc" },
        select: {
            id: true, classroomId: true, title: true, type: true, startAt: true, dueDate: true,
            allowLate: true, weightPoints: true, category: true, subtopic: true, bookId: true, chapterIndex: true, uploadId: true,
        },
    });

    const comps = await prisma.assignmentcompletion.findMany({
        where: { anonId: me, assignmentId: { in: asns.map(a => a.id) } },
        select: { assignmentId: true, status: true, scorePct: true, attemptCount: true, submittedAt: true, gradedAt: true, isLate: true, feedback: true },
    });
    const compMap = new Map(comps.map(c => [c.assignmentId, c]));

    const items = asns.map(a => {
        const s = compMap.get(a.id) || null;
        const due = a.dueDate ? new Date(a.dueDate) : null;
        const status = s?.status || "ASSIGNED";
        const isMissing = due && now > due && !["SUBMITTED", "GRADED", "LATE"].includes(status);
        const bucket = isMissing ? "MISSING" : (["SUBMITTED", "GRADED", "LATE"].includes(status) ? "COMPLETED" : "DUE_SOON");
        return {
            assignmentId: a.id,
            title: a.title,
            type: a.type,
            dueDate: due ? due.toISOString() : "",
            status,
            attemptCount: s?.attemptCount ?? 0,
            scorePct: s?.scorePct ?? "",
            isLate: s?.isLate ?? false,
            feedback: s?.feedback ?? null, // student can now see teacher's private comment for them
            bucket,
            classroomId: a.classroomId,
            classroomName: member.classroom?.name || "Class",
        };
    });

    return Response.json({ ok: true, data: items }, { headers: { "Cache-Control": "no-store" } });
}
