// app/api/my/assignments/route.js
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

// Returns a flat list the Dashboard can bucket (Due soon, Missing, Completed)
export async function GET(req) {
    const cs = await cookies();
    const me = cs.get("learnloomId")?.value;
    if (!me) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const now = new Date();
    const horizonDays = Number(url.searchParams.get("days") || 30);
    const to = new Date(now.getTime() + horizonDays * 86400000);

    // classes I'm in
    const classes = await prisma.studentclassroom.findMany({
        where: { anonId: me },
        select: { classroomId: true },
    });
    const classIds = classes.map(c => c.classroomId);
    if (!classIds.length) return Response.json({ ok: true, data: [] });

    // all assignments targeting me across my classes
    const asns = await prisma.assignment.findMany({
        where: {
            classroomId: { in: classIds },
            OR: [
                { targets: { some: { anonId: me } } },
                { targets: { some: { anonId: null } } }, // ALL
            ],
        },
        orderBy: { dueDate: "asc" },
        select: {
            id: true, classroomId: true, title: true, type: true, startAt: true, dueDate: true,
            allowLate: true, weightPoints: true, category: true, subtopic: true, bookId: true, chapterIndex: true, uploadId: true,
        },
    });

    const comp = await prisma.assignmentcompletion.findMany({
        where: { anonId: me, assignmentId: { in: asns.map(a => a.id) } },
        select: { assignmentId: true, status: true, scorePct: true, attemptCount: true, submittedAt: true, gradedAt: true, isLate: true },
    });
    const compMap = new Map(comp.map(c => [c.assignmentId, c]));

    const items = asns.map(a => {
        const s = compMap.get(a.id) || null;
        const due = a.dueDate ? new Date(a.dueDate) : null;
        const status = s?.status || "ASSIGNED";
        const isMissing = due && now > due && !["SUBMITTED", "GRADED", "LATE"].includes(status);
        const bucket = isMissing ? "MISSING" : (["SUBMITTED", "GRADED", "LATE"].includes(status) ? "COMPLETED" : "DUE_SOON");
        // deep link
        let href = "#";
        if (a.type === "BOOK") href = `/readingpal?bookIndex=${a.bookId ?? ""}&chapterIndex=${a.chapterIndex ?? ""}&from=assign:${a.id}`;
        if (a.type === "QUIZ") href = `/grammar?concept=${encodeURIComponent(a.category || "")}&subTopic=${encodeURIComponent(a.subtopic || "")}&start=1&from=assign:${a.id}`;
        if (a.type === "UPLOAD") href = `/uploads/${a.uploadId ?? ""}?from=assign:${a.id}`;

        return {
            assignmentId: a.id,
            title: a.title,
            type: a.type,
            dueDate: due ? due.toISOString() : "",
            status,
            attemptCount: s?.attemptCount ?? 0,
            scorePct: s?.scorePct ?? "",
            isLate: s?.isLate ?? false,
            bucket,
            href,
        };
    });

    return Response.json({ ok: true, data: items });
}
