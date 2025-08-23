// app/api/assignments/[aid]/submit/route.js
import prisma from "@/lib/prisma";
import { getAnonId, jsonOk, jsonErr } from "@/app/api/_util/auth";

export async function POST(req, { params }) {
    const aid = Number(params?.aid);
    if (!Number.isFinite(aid)) return jsonErr("Bad id", 400);

    const anonId = await getAnonId();
    if (!anonId) return jsonErr("Unauthorized", 401);

    const assignment = await prisma.assignment.findUnique({
        where: { id: aid },
        select: {
            id: true,
            classroomId: true,
            type: true,
            startAt: true,
            dueDate: true,
            allowLate: true,
            latePenaltyPct: true,
            category: true,
            subtopic: true,
            bookId: true,
            chapterIndex: true,
            uploadId: true,
            targets: { select: { anonId: true } },
        },
    });

    if (!assignment) return jsonErr("Not found", 404);
    // Must be in the classroom
    const member = await prisma.studentclassroom.findFirst({
        where: { classroomId: assignment.classroomId, anonId },
        select: { id: true },
    });
    if (!member) return jsonErr("Not in classroom", 403);
    // Must be targeted
    const targetsAll = assignment.targets.some(t => t.anonId == null);
    const targeted = targetsAll || assignment.targets.some(t => t.anonId === anonId);
    if (!targeted) return jsonErr("Not targeted", 403);
    const now = new Date();
    const due = assignment.dueDate ? new Date(assignment.dueDate) : null;
    const pastDue = due ? now > due : false;
    const status = pastDue && !assignment.allowLate ? "LATE" : "SUBMITTED";
    const isLate = pastDue && !!assignment.allowLate;

    // Load existing completion to preserve best score + attempts
    const prev = await prisma.assignmentcompletion.findUnique({
        where: { anonId_assignmentId: { anonId, assignmentId: aid } },
        select: { attemptCount: true, attemptsJson: true, scorePct: true },
    });
    const attempts = Array.isArray(prev?.attemptsJson) ? prev.attemptsJson : [];

    let nextScorePct = prev?.scorePct ?? null;
    let attemptEntry = { kind: assignment.type, at: now.toISOString() };

    // Type-specific validation / scoring source
    if (assignment.type === "QUIZ") {
        if (!assignment.category) {
            return jsonErr("Quiz meta missing", 400);
        }
        const latest = await prisma.grammarprogress.findFirst({
            where: {
                anonId,
                concept: assignment.category,
                subTopic: assignment.subtopic ?? "",
            },
            orderBy: { createdAt: "desc" },
            select: { id: true, score: true, numQuestions: true, createdAt: true },
        });
        if (!latest) {
            return jsonErr("No recent quiz attempt found", 400);
        }
        nextScorePct = Math.max(nextScorePct ?? 0, latest.score ?? 0);
        attemptEntry = {
            ...attemptEntry,
            ref: { table: "grammarprogress", id: latest.id },
            score: latest.score ?? null,
            numQuestions: latest.numQuestions ?? null,
            sourceAt: latest.createdAt?.toISOString?.() ?? null,
        };
    } else if (assignment.type === "BOOK") {
        if (assignment.bookId == null || assignment.chapterIndex == null) {
            return jsonErr("Reading meta missing", 400);
        }
        const rp = await prisma.readingprogress.findFirst({
            where: { anonId, bookIndex: assignment.bookId, chapterIndex: assignment.chapterIndex },
            orderBy: { updatedAt: "desc" },
            select: { id: true, timeMs: true, updatedAt: true },
        });
        if (!rp) return jsonErr("No reading progress found", 400);
        attemptEntry = {
            ...attemptEntry,
            ref: { table: "readingprogress", id: rp.id },
            timeMs: rp.timeMs ?? null,
            sourceAt: rp.updatedAt?.toISOString?.() ?? null,
        };
    } else if (assignment.type === "UPLOAD") {
        if (assignment.uploadId == null) {
            return jsonErr("Upload meta missing", 400);
        }
        const up = await prisma.uploadprogress.findFirst({
            where: { anonId, uploadId: assignment.uploadId },
            orderBy: { updatedAt: "desc" },
            select: { id: true, paraIndex: true, charOffset: true, timeMs: true, updatedAt: true },
        });
        if (!up) return jsonErr("No upload progress found", 400);
        attemptEntry = {
            ...attemptEntry,
            ref: { table: "uploadprogress", id: up.id },
            paraIndex: up.paraIndex,
            charOffset: up.charOffset,
            timeMs: up.timeMs,
            sourceAt: up.updatedAt?.toISOString?.() ?? null,
        };
    }

    const nextAttempts = [...attempts, attemptEntry];
    const nextAttemptCount = (prev?.attemptCount ?? 0) + 1;

    const updated = await prisma.assignmentcompletion.upsert({
        where: { anonId_assignmentId: { anonId, assignmentId: aid } },
        create: {
            assignmentId: aid,
            anonId,
            status,
            submittedAt: now,
            gradedAt: null,
            attemptCount: nextAttemptCount,
            attemptsJson: nextAttempts,
            scorePct: nextScorePct,
            isLate,
        },
        update: {
            status,
            submittedAt: now,
            attemptCount: nextAttemptCount,
            attemptsJson: nextAttempts,
            scorePct: nextScorePct,
            isLate,
        },
        select: {
            assignmentId: true,
            anonId: true,
            status: true,
            submittedAt: true,
            gradedAt: true,
            attemptCount: true,
            scorePct: true,
            isLate: true,
        },
    });

    return jsonOk(updated);
}
