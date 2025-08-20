// app/api/classrooms/[id]/metrics/export/route.js
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import JSZip from "jszip";

function ymd(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 10); }
function toCSV(headers, rows) {
    const esc = (v) => {
        if (v == null) return "";
        const s = String(v);
        const needs = /[",\n]/.test(s);
        return needs ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const head = headers.map(esc).join(",");
    const body = rows.map((r) => headers.map((h) => esc(r[h])).join(",")).join("\n");
    return `${head}\n${body}\n`;
}

export async function GET(req, { params }) {
    const id = Number(params?.id);
    if (!Number.isFinite(id)) return new Response("Bad id", { status: 400 });

    const url = new URL(req.url);
    const to = url.searchParams.get("to") ? new Date(url.searchParams.get("to")) : new Date();
    const from = url.searchParams.get("from")
        ? new Date(url.searchParams.get("from"))
        : new Date(to.getTime() - 30 * 86400000);

    const cs = await cookies();
    const anonId = cs.get("learnloomId")?.value;
    if (!anonId) return new Response("Unauthorized", { status: 401 });

    const cls = await prisma.classroom.findUnique({ where: { id }, select: { ownerAnon: true, id: true, name: true } });
    if (!cls) return new Response("Not found", { status: 404 });
    const teacherRow = await prisma.studentclassroom.findFirst({ where: { classroomId: id, anonId, role: "teacher" } });
    if (!(cls.ownerAnon === anonId || teacherRow)) return new Response("Forbidden", { status: 403 });

    // Roster anonIds
    const members = await prisma.studentclassroom.findMany({
        where: { classroomId: id },
        select: { anonId: true, role: true },
    });
    const studentAnonIds = members.filter(m => m.role !== "teacher" && m.anonId).map(m => m.anonId);
    const rosterIds = Array.from(new Set([cls.ownerAnon, ...studentAnonIds].filter(Boolean)));

    // Reading
    const reading = rosterIds.length
        ? await prisma.readingprogress.findMany({
            where: { anonId: { in: rosterIds }, updatedAt: { gte: from, lte: to } },
            select: { timeMs: true, updatedAt: true },
        })
        : [];
    const readingDailyMap = new Map();
    for (const r of reading) {
        const d = ymd(new Date(r.updatedAt));
        const min = Math.max(0, Math.round((r.timeMs || 0) / 60000));
        readingDailyMap.set(d, (readingDailyMap.get(d) || 0) + min);
    }
    const readingDaily = Array.from(readingDailyMap.entries()).sort().map(([date, minutes]) => ({ date, minutes }));

    // Grammar + pace + weak
    const grammar = rosterIds.length
        ? await prisma.grammarprogress.findMany({
            where: { anonId: { in: rosterIds }, createdAt: { gte: from, lte: to } },
            select: { createdAt: true, score: true, durationMs: true, numQuestions: true, concept: true, subTopic: true },
        })
        : [];
    const grammarDailyMap = new Map();
    const paceDailyMap = new Map();
    const weakMap = new Map();
    for (const g of grammar) {
        const d = ymd(new Date(g.createdAt));
        grammarDailyMap.set(d, (grammarDailyMap.get(d) || []).concat([g.score]));
        const n = Math.max(1, g.numQuestions || 0);
        if (g.durationMs) {
            const spq = (g.durationMs / 1000) / n;
            paceDailyMap.set(d, (paceDailyMap.get(d) || []).concat([spq]));
        }
        const key = `${g.concept}:::${g.subTopic}`;
        const rec = weakMap.get(key) || { sum: 0, n: 0, concept: g.concept, subTopic: g.subTopic };
        rec.sum += g.score; rec.n += 1; weakMap.set(key, rec);
    }
    const grammarDaily = Array.from(grammarDailyMap.entries()).sort()
        .map(([date, arr]) => ({ date, avg: arr.reduce((a, b) => a + b, 0) / arr.length }));
    const grammarPaceDaily = Array.from(paceDailyMap.entries()).sort()
        .map(([date, arr]) => ({ date, secPerQ: arr.reduce((a, b) => a + b, 0) / arr.length }));
    const topWeakAreas = Array.from(weakMap.values())
        .filter(x => x.n >= 3)
        .map(x => ({ concept: x.concept, subTopic: x.subTopic, avg: x.sum / x.n, attempts: x.n }))
        .sort((a, b) => a.avg - b.avg)
        .slice(0, 20);

    // Notes per student
    const notes = rosterIds.length
        ? await prisma.note.findMany({
            where: { anonId: { in: rosterIds }, createdAt: { gte: from, lte: to } },
            select: { anonId: true },
        })
        : [];
    const perStudent = new Map();
    for (const n of notes) perStudent.set(n.anonId, (perStudent.get(n.anonId) || 0) + 1);
    const notesPerStudent = Array.from(perStudent.entries()).map(([anonId, count]) => ({ anonId, count }));

    // CSVs
    const zip = new JSZip();
    zip.file("meta.txt", `classroom_id=${cls.id}\nname=${cls.name}\nfrom=${from.toISOString()}\nto=${to.toISOString()}\n`);
    zip.file("reading_daily.csv", toCSV(["date", "minutes"], readingDaily));
    zip.file("grammar_daily.csv", toCSV(["date", "avg"], grammarDaily));
    zip.file("grammar_pace_daily.csv", toCSV(["date", "secPerQ"], grammarPaceDaily));
    zip.file("top_weak_areas.csv", toCSV(["concept", "subTopic", "avg", "attempts"], topWeakAreas));
    zip.file("notes_per_student.csv", toCSV(["anonId", "count"], notesPerStudent));
    const buf = await zip.generateAsync({ type: "nodebuffer" });

    return new Response(buf, {
        status: 200,
        headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="classroom_${cls.id}_metrics.zip"`,
        },
    });
}
