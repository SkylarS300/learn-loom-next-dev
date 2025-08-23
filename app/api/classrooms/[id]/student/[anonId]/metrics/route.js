// app/api/classrooms/[id]/student/[anonId]/metrics/route.js
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

function ymd(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 10); }

export async function GET(req, ctx) {
    const p = ctx.params;
    const classId = Number(p?.id);
    const studentAnon = decodeURIComponent(p?.anonId || "");
    if (!Number.isFinite(classId) || !studentAnon) return Response.json({ ok: false, error: "Bad params" }, { status: 400 });

    const url = new URL(req.url);
    const to = url.searchParams.get("to") ? new Date(url.searchParams.get("to")) : new Date();
    const from = url.searchParams.get("from")
        ? new Date(url.searchParams.get("from"))
        : new Date(to.getTime() - 30 * 86400000);

    const cs = await cookies();
    const me = cs.get("learnloomId")?.value;
    if (!me) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const cls = await prisma.classroom.findUnique({ where: { id: classId }, select: { id: true, name: true, ownerAnon: true } });
    if (!cls) return Response.json({ ok: false, error: "Not found" }, { status: 404 });

    const teacherRow = await prisma.studentclassroom.findFirst({ where: { classroomId: classId, anonId: me, role: "teacher" } });
    if (!(cls.ownerAnon === me || teacherRow)) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

    // Ensure student is actually in this classroom
    const isMember = await prisma.studentclassroom.findFirst({ where: { classroomId: classId, anonId: studentAnon } });
    if (!isMember && studentAnon !== cls.ownerAnon) {
        return Response.json({ ok: false, error: "Student not in classroom" }, { status: 404 });
    }

    // Reading daily
    const rRows = await prisma.readingprogress.findMany({
        where: { anonId: studentAnon, updatedAt: { gte: from, lte: to } },
        select: { timeMs: true, updatedAt: true },
    });
    const rMsByDay = new Map(); // date -> total ms
    for (const r of rRows) {
        const d = ymd(new Date(r.updatedAt));
        rMsByDay.set(d, (rMsByDay.get(d) || 0) + Math.max(0, r.timeMs || 0));
    }
    const readingDaily = Array.from(rMsByDay.entries())
        .sort()
        .map(([date, ms]) => ({ date, minutes: Math.round(ms / 60000) }));

    // Grammar
    const gRows = await prisma.grammarprogress.findMany({
        where: { anonId: studentAnon, createdAt: { gte: from, lte: to } },
        select: { createdAt: true, score: true, concept: true, subTopic: true, durationMs: true, numQuestions: true, hintsUsed: true, isAi: true },
        orderBy: { createdAt: "desc" },
    });
    const gMap = new Map();
    const paceMap = new Map();
    for (const g of gRows) {
        const d = ymd(new Date(g.createdAt));
        gMap.set(d, (gMap.get(d) || []).concat([g.score]));
        if (g.durationMs && g.numQuestions) {
            const spq = (g.durationMs / 1000) / Math.max(1, g.numQuestions);
            paceMap.set(d, (paceMap.get(d) || []).concat([spq]));
        }
    }
    const grammarDaily = Array.from(gMap.entries()).sort()
        .map(([date, arr]) => ({ date, avg: arr.reduce((a, b) => a + b, 0) / arr.length }));
    const grammarPaceDaily = Array.from(paceMap.entries()).sort()
        .map(([date, arr]) => ({ date, secPerQ: arr.reduce((a, b) => a + b, 0) / arr.length }));

    // Weak topics for this student
    const weakMap = new Map();
    for (const g of gRows) {
        const key = `${g.concept}:::${g.subTopic}`;
        const rec = weakMap.get(key) || { concept: g.concept, subTopic: g.subTopic, sum: 0, n: 0 };
        rec.sum += g.score; rec.n += 1; weakMap.set(key, rec);
    }
    const weak = Array.from(weakMap.values()).filter(x => x.n >= 3)
        .map(x => ({ concept: x.concept, subTopic: x.subTopic, avg: x.sum / x.n, attempts: x.n }))
        .sort((a, b) => a.avg - b.avg)
        .slice(0, 10);

    // Recent notes
    const notesRecent = await prisma.note.findMany({
        where: { anonId: studentAnon, createdAt: { gte: from, lte: to } },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: { id: true, targetType: true, anchorText: true, color: true, createdAt: true, isBookmark: true },
    });

    return Response.json({
        ok: true,
        data: {
            classroom: { id: cls.id, name: cls.name },
            anonId: studentAnon,
            readingDaily,
            grammarDaily,
            grammarPaceDaily,
            weak,
            notesRecent,
            from: from.toISOString().slice(0, 10),
            to: to.toISOString().slice(0, 10),
            attempts: gRows.length,
        },
    });
}
