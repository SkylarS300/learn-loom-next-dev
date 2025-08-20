// app/api/classrooms/[id]/student/[anonId]/metrics/export/route.js
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import JSZip from "jszip";

// CSV helper (same pattern you use elsewhere)
function toCSV(headers, rows) {
    const esc = (v) => {
        if (v == null) return "";
        const s = String(v);
        const needsQuotes = /[",\n]/.test(s);
        return needsQuotes ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const head = headers.map(esc).join(",");
    const body = rows.map((r) => headers.map((h) => esc(r[h])).join(",")).join("\n");
    return `${head}\n${body}\n`;
}
const ymd = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 10);

export async function GET(req, ctx) {
    const p = ctx.params;
    const classId = Number(p?.id);
    const studentAnon = decodeURIComponent(p?.anonId || "");
    if (!Number.isFinite(classId) || !studentAnon) {
        return NextResponse.json({ ok: false, error: "Bad params" }, { status: 400 });
    }

    const url = new URL(req.url);
    const to = url.searchParams.get("to") ? new Date(url.searchParams.get("to")) : new Date();
    const from = url.searchParams.get("from")
        ? new Date(url.searchParams.get("from"))
        : new Date(to.getTime() - 30 * 86400000); // default 30 days

    const cs = await cookies();
    const me = cs.get("learnloomId")?.value;
    if (!me) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    // Classroom + auth checks
    const cls = await prisma.classroom.findUnique({
        where: { id: classId },
        select: { id: true, name: true, ownerAnon: true },
    });
    if (!cls) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    const teacherRow = await prisma.studentclassroom.findFirst({
        where: { classroomId: classId, anonId: me, role: "teacher" },
        select: { id: true },
    });
    if (!(cls.ownerAnon === me || teacherRow)) {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    // Confirm the target student is enrolled (or is owner)
    const member = await prisma.studentclassroom.findFirst({
        where: { classroomId: classId, anonId: studentAnon },
        select: { displayName: true },
    });
    if (!member && studentAnon !== cls.ownerAnon) {
        return NextResponse.json({ ok: false, error: "Student not in classroom" }, { status: 404 });
    }
    const displayName = member?.displayName || "";

    // ---- Reading progress (raw + daily agg) ----
    const readingRows = await prisma.readingprogress.findMany({
        where: { anonId: studentAnon, updatedAt: { gte: from, lte: to } },
        select: { bookIndex: true, chapterIndex: true, sentenceIndex: true, timeMs: true, updatedAt: true, completedAt: true },
        orderBy: [{ updatedAt: "desc" }, { completedAt: "desc" }],
    });

    const rMap = new Map(); // date -> minutes
    readingRows.forEach((r) => {
        const d = ymd(new Date(r.updatedAt));
        const add = Math.max(0, Math.round((r.timeMs || 0) / 60000));
        rMap.set(d, (rMap.get(d) || 0) + add);
    });
    const readingDaily = Array.from(rMap.entries())
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([date, minutes]) => ({ date, minutes }));

    // ---- Grammar attempts (raw + daily avgs + pace) ----
    const grammarRows = await prisma.grammarprogress.findMany({
        where: { anonId: studentAnon, createdAt: { gte: from, lte: to } },
        select: { createdAt: true, score: true, concept: true, subTopic: true, durationMs: true, numQuestions: true, hintsUsed: true, isAi: true },
        orderBy: { createdAt: "desc" },
    });

    const gMap = new Map();     // date -> [scores]
    const paceMap = new Map();  // date -> [sec/q]
    grammarRows.forEach((g) => {
        const d = ymd(new Date(g.createdAt));
        gMap.set(d, (gMap.get(d) || []).concat([g.score]));
        if (g.durationMs && g.numQuestions) {
            const spq = (g.durationMs / 1000) / Math.max(1, g.numQuestions);
            paceMap.set(d, (paceMap.get(d) || []).concat([spq]));
        }
    });

    const grammarDaily = Array.from(gMap.entries())
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([date, arr]) => ({ date, avg: arr.reduce((a, b) => a + b, 0) / arr.length }));

    const grammarPaceDaily = Array.from(paceMap.entries())
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([date, arr]) => ({ date, secPerQ: arr.reduce((a, b) => a + b, 0) / arr.length }));

    // ---- Upload reading (raw) ----
    const uploadRows = await prisma.uploadprogress.findMany({
        where: { anonId: studentAnon, updatedAt: { gte: from, lte: to } },
        select: { uploadId: true, paraIndex: true, charOffset: true, timeMs: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
    });

    // ---- Assignments for this classroom for this student ----
    const submissions = await prisma.assignmentcompletion.findMany({
        where: {
            anonId: studentAnon,
            assignment: { classroomId: classId },
        },
        select: {
            status: true, completedAt: true, submittedAt: true, gradedAt: true,
            quizScore: true, scorePct: true, scorePoints: true, attemptCount: true,
            isLate: true, feedback: true,
            assignment: {
                select: { id: true, title: true, type: true, dueDate: true, startAt: true, weightPoints: true },
            },
        },
        orderBy: [{ gradedAt: "desc" }, { submittedAt: "desc" }, { completedAt: "desc" }],
    });

    // ---- Build CSVs ----
    const overviewHeaders = ["classroomId", "classroomName", "studentAnon", "displayName", "from", "to", "readingDays", "grammarAttempts", "uploadSessions", "assignments"];
    const overviewRows = [{
        classroomId: cls.id,
        classroomName: cls.name,
        studentAnon,
        displayName,
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
        readingDays: readingDaily.length,
        grammarAttempts: grammarRows.length,
        uploadSessions: uploadRows.length,
        assignments: submissions.length,
    }];
    const overviewCSV = toCSV(overviewHeaders, overviewRows);

    const readingHeaders = ["date", "minutes"];
    const readingCSV = toCSV(readingHeaders, readingDaily);

    const grammarHeaders = ["createdAt", "concept", "subTopic", "score", "durationMs", "numQuestions", "hintsUsed", "isAi", "secPerQ"];
    const grammarRowsCSV = toCSV(
        grammarHeaders,
        grammarRows.map(g => ({
            createdAt: g.createdAt?.toISOString?.() || g.createdAt,
            concept: g.concept, subTopic: g.subTopic || "",
            score: g.score, durationMs: g.durationMs ?? "",
            numQuestions: g.numQuestions ?? "",
            hintsUsed: g.hintsUsed ?? "",
            isAi: g.isAi ? "1" : "0",
            secPerQ: (g.durationMs && g.numQuestions) ? ((g.durationMs / 1000) / Math.max(1, g.numQuestions)).toFixed(2) : "",
        }))
    );

    const uploadsHeaders = ["uploadId", "paraIndex", "charOffset", "timeMs", "updatedAt"];
    const uploadsCSV = toCSV(
        uploadsHeaders,
        uploadRows.map(u => ({
            uploadId: u.uploadId,
            paraIndex: u.paraIndex ?? "",
            charOffset: u.charOffset ?? "",
            timeMs: u.timeMs ?? "",
            updatedAt: u.updatedAt?.toISOString?.() || u.updatedAt,
        }))
    );

    const assignHeaders = ["assignmentId", "title", "type", "startAt", "dueDate", "weightPoints", "status", "scorePct", "scorePoints", "attemptCount", "isLate", "submittedAt", "gradedAt", "feedback"];
    const assignCSV = toCSV(
        assignHeaders,
        submissions.map(s => ({
            assignmentId: s.assignment.id,
            title: s.assignment.title,
            type: s.assignment.type,
            startAt: s.assignment.startAt?.toISOString?.() || s.assignment.startAt || "",
            dueDate: s.assignment.dueDate?.toISOString?.() || s.assignment.dueDate || "",
            weightPoints: s.assignment.weightPoints ?? "",
            status: s.status,
            scorePct: s.scorePct ?? s.quizScore ?? "",
            scorePoints: s.scorePoints ?? "",
            attemptCount: s.attemptCount ?? 0,
            isLate: s.isLate ? "1" : "0",
            submittedAt: s.submittedAt?.toISOString?.() || s.submittedAt || "",
            gradedAt: s.gradedAt?.toISOString?.() || s.gradedAt || "",
            feedback: s.feedback ?? "",
        }))
    );

    // ---- ZIP & return ----
    const zip = new JSZip();
    zip.file("student_overview.csv", overviewCSV);
    zip.file("reading.csv", readingCSV);
    zip.file("grammar.csv", grammarRowsCSV);
    zip.file("uploads.csv", uploadsCSV);
    zip.file("assignments_student.csv", assignCSV);

    const blob = await zip.generateAsync({ type: "nodebuffer" });
    return new NextResponse(blob, {
        status: 200,
        headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="class-${cls.id}-student-${encodeURIComponent(studentAnon)}.zip"`,
        },
    });
}
