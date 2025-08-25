// app/api/classrooms/[id]/assignments/me/route.js
import prisma from "@/lib/prisma";
import { getAnonId, jsonOk, jsonErr } from "@/app/api/_util/auth";

export async function GET(req, ctx) {
    const { id } = await ctx.params;
    const classId = Number(id);
    if (!Number.isFinite(classId)) return jsonErr("Bad id", 400);

    const me = await getAnonId();
    if (!me) return jsonErr("Unauthorized", 401);

    // Must be in class and not a teacher
    const member = await prisma.studentclassroom.findFirst({
        where: { classroomId: classId, anonId: me },
        select: { role: true },
    });
    if (!member) return jsonErr("Forbidden", 403);
    if ((member.role || "student") === "teacher") return jsonErr("Forbidden", 403);

    const url = new URL(req.url);
    const horizonDays = Math.max(1, Number(url.searchParams.get("days") || 30));
    const now = new Date();
    const to = new Date(now.getTime() + horizonDays * 86400000);

    // class assignments targeted to me
    const asns = await prisma.assignment.findMany({
        where: {
            classroomId: classId,
            OR: [
                { targets: { some: { anonId: me } } },
                { targets: { some: { anonId: null } } }, // ALL
            ],
            OR: [{ dueDate: null }, { dueDate: { lte: to } }],
        },
        orderBy: { dueDate: "asc" },
        select: {
            id: true, classroomId: true, title: true, type: true, startAt: true, dueDate: true,
            allowLate: true, latePenaltyPct: true, weightPoints: true,
            category: true, subtopic: true, bookId: true, chapterIndex: true, uploadId: true,
        },
    });

    const comp = await prisma.assignmentcompletion.findMany({
        where: { anonId: me, assignmentId: { in: asns.map((a) => a.id) } },
        select: { assignmentId: true, status: true, scorePct: true, attemptCount: true, submittedAt: true, gradedAt: true, isLate: true },
    });
    const compMap = new Map(comp.map((c) => [c.assignmentId, c]));

    const items = asns.map((a) => {
        const s = compMap.get(a.id) || null;
        const due = a.dueDate ? new Date(a.dueDate) : null;
        const status = s?.status || "ASSIGNED";
        const isMissing = due && now > due && !["SUBMITTED", "GRADED", "LATE"].includes(status);

        let href = "#";
        if (a.type === "BOOK" && Number.isInteger(a.bookId) && Number.isInteger(a.chapterIndex)) {
            href = `/readingpal?bookIndex=${a.bookId}&chapterIndex=${a.chapterIndex}&from=assign:${a.id}`;
        } else if (a.type === "QUIZ" && a.category) {
            href = `/grammar?concept=${encodeURIComponent(a.category)}&subTopic=${encodeURIComponent(a.subtopic || "")}&start=1&from=assign:${a.id}`;
        } else if (a.type === "UPLOAD" && Number.isInteger(a.uploadId)) {
            href = `/uploads/${a.uploadId}?from=assign:${a.id}`;
        }

        return {
            assignmentId: a.id,
            title: a.title,
            type: a.type,
            dueDate: due ? due.toISOString() : "",
            status,
            attemptCount: s?.attemptCount ?? 0,
            scorePct: s?.scorePct ?? "",
            isLate: s?.isLate ?? false,
            bucket: isMissing ? "MISSING" : (["SUBMITTED", "GRADED", "LATE"].includes(status) ? "COMPLETED" : "DUE_SOON"),
            href,
        };
    });

    return jsonOk(items);
}
