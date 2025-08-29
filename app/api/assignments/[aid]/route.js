// app/api/assignments/[aid]/route.js
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

// GET: detail + per-student table (teacher-only)
export async function GET(_req, ctx) {
    const { aid } = await ctx.params;
    const id = Number(aid);
    if (!Number.isFinite(id)) return jsonErr("Bad id", 400);

    const me = await getAnonId();
    if (!me) return jsonErr("Unauthorized", 401);

    const auth = await requireTeacherByAid(me, id);
    if (!auth.ok) return jsonErr(auth.error, auth.status);

    const [a, roster, subs] = await Promise.all([
        prisma.assignment.findUnique({
            where: { id },
            select: {
                id: true, classroomId: true, title: true, description: true, type: true,
                startAt: true, dueDate: true, allowLate: true, latePenaltyPct: true, weightPoints: true,
                category: true, subtopic: true, bookId: true, chapterIndex: true, uploadId: true,
                targets: { select: { anonId: true, overridesJson: true } },
                createdAt: true,
            },
        }),
        prisma.studentclassroom.findMany({
            where: { classroomId: auth.classroomId, role: { not: "teacher" } },
            select: { anonId: true, displayName: true },
        }),
        prisma.assignmentcompletion.findMany({
            where: { assignmentId: id },
            select: {
                anonId: true, status: true, attemptCount: true, scorePct: true, gradedAt: true, submittedAt: true, isLate: true,
            },
        }),
    ]);

    if (!a) return jsonErr("Not found", 404);

    const nameMap = new Map(roster.map(r => [r.anonId || "", r.displayName || ""]));
    const subMap = new Map((subs || []).map(s => [s.anonId || "", s]));

    const targetedAll = a.targets.some(t => t.anonId == null);
    const targetedSet = targetedAll ? new Set(roster.map(r => r.anonId)) : new Set(a.targets.map(t => t.anonId));
    const targetedIds = Array.from(targetedSet);

    // Preload per-student progress details for this assignment

    let bookProgByAnon: Map<string, { timeMs: number; completedAt: string | null }> | null = null;
    let quizProgByAnon: Map<string, { lastScore: number | null; attemptedAt: string | null }> | null = null;
    let uploadProgByAnon: Map<string, { timeMs: number | null; paraIndex: number | null; updatedAt: string | null }> | null = null;

    if (a.type === "BOOK" && Number.isInteger(a.bookId) && Number.isInteger(a.chapterIndex) && targetedIds.length) {
        const prog = await prisma.readingprogress.findMany({
            where: {
                anonId: { in: targetedIds },
                bookIndex: Number(a.bookId),
                chapterIndex: Number(a.chapterIndex),
            },
            select: { anonId: true, timeMs: true, completedAt: true },
        });
        bookProgByAnon = new Map(
            prog.map(p => [p.anonId!, { timeMs: p.timeMs ?? 0, completedAt: p.completedAt?.toISOString?.() ?? null }])
        );
    }
    if (a.type === "QUIZ" && a.category && targetedIds.length) {
        // Get the latest attempt per anonId (match concept + optional subtopic)
        const attempts = await prisma.grammarprogress.findMany({
            where: {
                anonId: { in: targetedIds },
                concept: a.category,
                ...(a.subtopic ? { subTopic: a.subtopic } : {}),
            },
            orderBy: { createdAt: "desc" },
            select: { anonId: true, score: true, createdAt: true },
        });
        // Keep only the latest per anonId
        quizProgByAnon = new Map();
        for (const att of attempts) {
            if (!quizProgByAnon.has(att.anonId!)) {
                quizProgByAnon.set(att.anonId!, { lastScore: att.score ?? null, attemptedAt: att.createdAt?.toISOString?.() ?? null });
            }
        }
    }
    if (a.type === "UPLOAD" && Number.isInteger(a.uploadId) && targetedIds.length) {
        // Pull each student's current progress on this upload
        try {
            const ups = await prisma.uploadprogress.findMany({
                where: {
                    anonId: { in: targetedIds },
                    uploadId: Number(a.uploadId),
                },
                select: { anonId: true, paraIndex: true, timeMs: true, updatedAt: true },
            });
            uploadProgByAnon = new Map(
                ups.map(u => [u.anonId!, {
                    timeMs: (u as any).timeMs ?? null,
                    paraIndex: u.paraIndex ?? null,
                    updatedAt: u.updatedAt?.toISOString?.() ?? null,
                }])
            );
        } catch {
            // legacy (no timeMs)
            const ups = await prisma.uploadprogress.findMany({
                where: {
                    anonId: { in: targetedIds },
                    uploadId: Number(a.uploadId),
                },
                select: { anonId: true, paraIndex: true, updatedAt: true },
            });
            uploadProgByAnon = new Map(
                ups.map(u => [u.anonId!, {
                    timeMs: null,
                    paraIndex: u.paraIndex ?? null,
                    updatedAt: u.updatedAt?.toISOString?.() ?? null,
                }])
            );
        }
    }

    const table = roster
        .filter(r => targetedSet.has(r.anonId))
        .map(r => {
            const s = subMap.get(r.anonId) || null;
            const bp = bookProgByAnon?.get(r.anonId) || null;
            const qp = quizProgByAnon?.get(r.anonId) || null;
            const up = uploadProgByAnon?.get(r.anonId) || null;
            return {
                anonId: r.anonId,
                displayName: r.displayName || "",
                status: s?.status || "ASSIGNED",
                attemptCount: s?.attemptCount ?? 0,
                scorePct: s?.scorePct ?? "",
                submittedAt: s?.submittedAt || "",
                gradedAt: s?.gradedAt || "",
                // New progressive detail fields (optional; null-safe on UI)
                readTimeMs: bp?.timeMs ?? null,
                chapterCompletedAt: bp?.completedAt ?? null,
                lastQuizScore: qp?.lastScore ?? null,
                quizAttemptedAt: qp?.attemptedAt ?? null,
                uploadTimeMs: up?.timeMs ?? null,
                uploadParaIndex: up?.paraIndex ?? null,
                uploadUpdatedAt: up?.updatedAt ?? null,
            };
        });

    return jsonOk({ assignment: a, students: table });
}

// PATCH: teacher grading/override
export async function PATCH(req, ctx) {
    const { aid } = await ctx.params;
    const id = Number(aid);
    if (!Number.isFinite(id)) return jsonErr("Bad id", 400);

    const me = await getAnonId();
    if (!me) return jsonErr("Unauthorized", 401);

    const auth = await requireTeacherByAid(me, id);
    if (!auth.ok) return jsonErr(auth.error, auth.status);

    const Body = z.object({
        anonId: z.string().min(1),
        status: z.enum(["ASSIGNED", "SUBMITTED", "GRADED", "LATE", "MISSING"]).optional(),
        scorePct: z.number().min(0).max(100).nullable().optional(),
        scorePoints: z.number().nullable().optional(),
        feedback: z.string().max(4000).nullable().optional(),
        isLate: z.boolean().optional(),
    });

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return jsonErr("Invalid request", 400, { issues: parsed.error.issues });

    const { anonId, status, scorePct, scorePoints, feedback, isLate } = parsed.data;

    // fetch assignment to apply late policy consistently
    const a = await prisma.assignment.findUnique({
        where: { id },
        select: { allowLate: true, latePenaltyPct: true },
    });
    if (!a) return jsonErr("Not found", 404);

    const now = new Date();

    // compute effective score considering late penalty if applicable
    let effectivePct = typeof scorePct === "number" ? scorePct : undefined;
    const isMarkedLate = isLate === true || status === "LATE";
    if (typeof effectivePct === "number" && a.allowLate && a.latePenaltyPct != null && isMarkedLate) {
        // apply flat percentage penalty (e.g., 10% => scorePct-10), clamp to [0,100]
        effectivePct = Math.max(0, Math.min(100, Math.round((effectivePct - a.latePenaltyPct) * 10) / 10));
    }

    const updated = await prisma.assignmentcompletion.upsert({
        where: { anonId_assignmentId: { anonId, assignmentId: id } },
        update: {
            status: status || undefined,
            scorePct: typeof effectivePct === "number" ? effectivePct : undefined,
            scorePoints: typeof scorePoints === "number" ? scorePoints : undefined,
            feedback: typeof feedback === "string" ? feedback : undefined,
            isLate: typeof isLate === "boolean" ? isLate : undefined,
            gradedAt: now,
        },
        create: {
            assignmentId: id,
            anonId,
            status: status || "GRADED",
            scorePct: typeof effectivePct === "number" ? effectivePct : null,
            scorePoints: typeof scorePoints === "number" ? scorePoints : null,
            attemptCount: 0,
            attemptsJson: [],
            feedback: typeof feedback === "string" ? feedback : null,
            isLate: !!isLate || status === "LATE",
            gradedAt: now,
        },
        select: { anonId: true, status: true, scorePct: true, scorePoints: true, gradedAt: true, feedback: true, isLate: true },
    });

    return jsonOk(updated);
}