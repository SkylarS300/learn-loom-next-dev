// app/api/classrooms/[id]/roster/route.js
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

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

// GET /api/classrooms/:id/roster
// returns [{ anonId, displayName, role, stats: { readingMin7d, quizAvgPct7d, lastSeen } }]
export async function GET(req, ctx) {
    const classId = Number((await ctx.params)?.id);
    if (!Number.isFinite(classId)) return Response.json({ ok: false, error: "Bad id" }, { status: 400 });

    const cs = await cookies();
    const me = cs.get("learnloomId")?.value;
    if (!me) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const auth = await requireTeacher(me, classId);
    if (!auth.ok) return Response.json({ ok: false, error: auth.error }, { status: auth.status });

    const roster = await prisma.studentclassroom.findMany({
        where: { classroomId: classId },
        select: { anonId: true, displayName: true, role: true },
    });

    const studentIds = roster.map(r => r.anonId).filter(Boolean);
    if (!studentIds.length) return Response.json({ ok: true, data: roster });

    const now = new Date();
    const from = new Date(now.getTime() - 7 * 86400000);

    const [reads, quizzes] = await Promise.all([
        prisma.readingprogress.findMany({
            where: { anonId: { in: studentIds }, updatedAt: { gte: from } },
            select: { anonId: true, timeMs: true, updatedAt: true },
        }),
        prisma.grammarprogress.findMany({
            where: { anonId: { in: studentIds }, createdAt: { gte: from } },
            select: { anonId: true, score: true, createdAt: true },
        }),
    ]);

    const readAgg = new Map();   // anonId -> { ms, last }
    for (const r of reads) {
        const a = readAgg.get(r.anonId) || { ms: 0, last: null };
        a.ms += Math.max(0, r.timeMs ?? 0);
        a.last = !a.last || (r.updatedAt > a.last) ? r.updatedAt : a.last;
        readAgg.set(r.anonId, a);
    }

    const quizAgg = new Map();   // anonId -> { sum, cnt, last }
    for (const q of quizzes) {
        const a = quizAgg.get(q.anonId) || { sum: 0, cnt: 0, last: null };
        a.sum += q.score ?? 0;
        a.cnt += 1;
        a.last = !a.last || (q.createdAt > a.last) ? q.createdAt : a.last;
        quizAgg.set(q.anonId, a);
    }

    const data = roster.map(r => {
        const ra = readAgg.get(r.anonId) || { ms: 0, last: null };
        const qa = quizAgg.get(r.anonId) || { sum: 0, cnt: 0, last: null };
        const lastSeen = [ra.last, qa.last].filter(Boolean).sort((a, b) => b - a)[0] || null;
        return {
            ...r,
            stats: {
                readingMin7d: Math.round((ra.ms || 0) / 60000),
                quizAvgPct7d: qa.cnt ? Math.round((qa.sum / qa.cnt)) : null,
                lastSeen: lastSeen ? lastSeen.toISOString() : null,
            },
        };
    });

    return Response.json({ ok: true, data }, { status: 200 });
}
