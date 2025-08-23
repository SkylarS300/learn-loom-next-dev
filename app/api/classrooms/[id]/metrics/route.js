// app/api/classrooms/[id]/metrics/route.js
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

function ymd(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 10); }

export async function GET(_req, { params }) {
    const id = Number(params?.id);
    if (!Number.isFinite(id)) return Response.json({ ok: false, error: "Bad id" }, { status: 400 });

    const cs = await cookies();
    const anonId = cs.get("learnloomId")?.value;
    if (!anonId) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const cls = await prisma.classroom.findUnique({ where: { id }, select: { ownerAnon: true, id: true, name: true } });
    if (!cls) return Response.json({ ok: false, error: "Not found" }, { status: 404 });

    // Role checks
    const teacherRow = await prisma.studentclassroom.findFirst({
        where: { classroomId: id, anonId, role: "teacher" },
    });
    const memberRow = await prisma.studentclassroom.findFirst({
        where: { classroomId: id, anonId },
        select: { id: true },
    });
    const isTeacher = !!teacherRow || cls.ownerAnon === anonId;
    const isMember = isTeacher || !!memberRow;
    if (!isMember) {
        return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(_req.url);
    const to = url.searchParams.get("to") ? new Date(url.searchParams.get("to")) : new Date();
    const from = url.searchParams.get("from")
        ? new Date(url.searchParams.get("from"))
        : new Date(to.getTime() - 30 * 86400000);

    // roster anonIds
    const members = await prisma.studentclassroom.findMany({
        where: { classroomId: id },
        select: { anonId: true, role: true },
    });
    const studentAnonIds = members.filter(m => m.role !== "teacher" && m.anonId).map(m => m.anonId);
    const rosterIds = Array.from(new Set([cls.ownerAnon, ...studentAnonIds].filter(Boolean)));

    // reading time (minutes) by day
    const reading = rosterIds.length
        ? await prisma.readingprogress.findMany({
            where: { anonId: { in: rosterIds }, updatedAt: { gte: from, lte: to } },
            select: { timeMs: true, updatedAt: true },
        })
        : [];
    const readingMsDaily = new Map(); // date -> total ms
    for (const r of reading) {
        const d = ymd(new Date(r.updatedAt));
        readingMsDaily.set(d, (readingMsDaily.get(d) || 0) + Math.max(0, r.timeMs || 0));
    }
    const readingDaily = Array.from(readingMsDaily.entries())
        .sort()
        .map(([date, ms]) => ({ date, minutes: Math.round(ms / 60000) }));

    // grammar avg score by day
    const grammar = rosterIds.length
        ? await prisma.grammarprogress.findMany({
            where: { anonId: { in: rosterIds }, createdAt: { gte: from, lte: to } },
            select: { createdAt: true, score: true, concept: true, subTopic: true, durationMs: true, numQuestions: true },
        })
        : [];
    const grammarDailyMap = new Map();
    const paceDailyMap = new Map();
    const weakMap = new Map(); // key=concept|subTopic -> {sum, n}

    for (const g of grammar) {
        const d = ymd(new Date(g.createdAt));
        grammarDailyMap.set(d, (grammarDailyMap.get(d) || []).concat([g.score]));
        const n = Math.max(1, g.numQuestions || 0);
        if (g.durationMs && n > 0) {
            const spq = (g.durationMs / 1000) / n;
            paceDailyMap.set(d, (paceDailyMap.get(d) || []).concat([spq]));
        }
        const key = `${g.concept}:::${g.subTopic}`;
        const rec = weakMap.get(key) || { sum: 0, n: 0, concept: g.concept, subTopic: g.subTopic };
        rec.sum += g.score; rec.n += 1;
        weakMap.set(key, rec);
    }
    const grammarDaily = Array.from(grammarDailyMap.entries()).sort()
        .map(([date, arr]) => ({ date, avg: arr.reduce((a, b) => a + b, 0) / arr.length }));
    const grammarPaceDaily = Array.from(paceDailyMap.entries()).sort()
        .map(([date, arr]) => ({ date, secPerQ: arr.reduce((a, b) => a + b, 0) / arr.length }));
    const topWeakAreas = Array.from(weakMap.values())
        .filter(x => x.n >= 3)
        .map(x => ({ concept: x.concept, subTopic: x.subTopic, avg: x.sum / x.n, attempts: x.n }))
        .sort((a, b) => a.avg - b.avg)
        .slice(0, 7);

    // notes per student (counts). Only expose at teacher level to avoid anonId leakage.
    let notesPerStudent = [];
    if (isTeacher && rosterIds.length) {
        const notes = await prisma.note.findMany({
            where: { anonId: { in: rosterIds }, createdAt: { gte: from, lte: to } },
            select: { anonId: true },
        });
        const perStudent = new Map();
        for (const n of notes) perStudent.set(n.anonId, (perStudent.get(n.anonId) || 0) + 1);
        notesPerStudent = Array.from(perStudent.entries()).map(([anonId, count]) => ({ anonId, count }));
    }

    return Response.json({
        ok: true,
        data: {
            classroom: { id: cls.id, name: cls.name },
            roster: { students: studentAnonIds.length },
            readingDaily,
            grammarDaily,
            grammarPaceDaily,
            topWeakAreas,
            notesPerStudent,
            from: from.toISOString().slice(0, 10),
            to: to.toISOString().slice(0, 10),
            canExport: isTeacher,
        },
    });
}
