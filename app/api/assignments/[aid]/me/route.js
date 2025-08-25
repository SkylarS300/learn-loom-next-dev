// app/api/assignments/[aid]/me/route.js
import prisma from "@/lib/prisma";
import { z } from "zod";
import { getAnonId, jsonOk, jsonErr } from "@/app/api/_util/auth";

// Helper: load assignment + confirm the student is in the class & targeted
async function loadCtx(aid, anonId) {
    const a = await prisma.assignment.findUnique({
        where: { id: aid },
        select: {
            id: true, classroomId: true, title: true, description: true, type: true,
            startAt: true, dueDate: true, allowLate: true, latePenaltyPct: true, weightPoints: true,
            category: true, subtopic: true, bookId: true, chapterIndex: true, uploadId: true,
            classroom: { select: { id: true } },
            targets: { select: { anonId: true } },
            createdAt: true,
        },
    });
    if (!a) return { ok: false, error: "Not found", status: 404 };

    // must be a class member (student or teacher). Teachers shouldn't use /me.
    const member = await prisma.studentclassroom.findFirst({
        where: { classroomId: a.classroomId, anonId },
        select: { role: true },
    });
    if (!member) return { ok: false, error: "Not in classroom", status: 403 };
    if (member.role === "teacher") return { ok: false, error: "Teachers should not use /me", status: 403 };

    // targeted? (null anonId means "all")
    const targetedAll = a.targets.some(t => t.anonId == null);
    const isTargeted = targetedAll || a.targets.some(t => t.anonId === anonId);
    if (!isTargeted) return { ok: false, error: "Not assigned to you", status: 403 };

    return { ok: true, a };
}

// GET: current student's view of one assignment
export async function GET(_req, ctx) {
    const { aid } = (await ctx)?.params ?? {};
    const id = Number(aid);
    if (!Number.isFinite(id)) return jsonErr("Bad id", 400);

    const me = await getAnonId();
    if (!me) return jsonErr("Unauthorized", 401);

    const ctxLoad = await loadCtx(id, me);
    if (!ctxLoad.ok) return jsonErr(ctxLoad.error, ctxLoad.status);
    const a = ctxLoad.a;

    const row = await prisma.assignmentcompletion.findUnique({
        where: { anonId_assignmentId: { anonId: me, assignmentId: id } },
        select: {
            status: true, attemptCount: true, scorePct: true, scorePoints: true,
            submittedAt: true, gradedAt: true, feedback: true, isLate: true,
        },
    });

    const now = new Date();
    const due = a.dueDate ? new Date(a.dueDate) : null;

    // allowed actions
    const status = row?.status || "ASSIGNED";
    const graded = !!row?.gradedAt;
    const afterDue = !!(due && now > due);
    const canSubmit = !graded && (!afterDue || a.allowLate === true);
    const canUnsubmit = !graded && status === "SUBMITTED";

    return jsonOk({
        assignment: a,
        me: {
            anonId: me,
            status,
            attemptCount: row?.attemptCount ?? 0,
            scorePct: row?.scorePct ?? null,
            scorePoints: row?.scorePoints ?? null,
            submittedAt: row?.submittedAt || null,
            gradedAt: row?.gradedAt || null,
            feedback: row?.feedback || "",
            isLate: !!row?.isLate,
        },
        permissions: { canSubmit, canUnsubmit },
    });
}

// PATCH: { action: "SUBMIT" | "UNSUBMIT" | "RESUBMIT" }
export async function PATCH(req, ctx) {
    const { aid } = (await ctx)?.params ?? {};
    const id = Number(aid);
    if (!Number.isFinite(id)) return jsonErr("Bad id", 400);

    const me = await getAnonId();
    if (!me) return jsonErr("Unauthorized", 401);

    const Body = z.object({
        action: z.enum(["SUBMIT", "UNSUBMIT", "RESUBMIT"]),
    });
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return jsonErr("Invalid request", 400, { issues: parsed.error.issues });
    const { action } = parsed.data;

    const ctxLoad = await loadCtx(id, me);
    if (!ctxLoad.ok) return jsonErr(ctxLoad.error, ctxLoad.status);
    const a = ctxLoad.a;

    const existing = await prisma.assignmentcompletion.findUnique({
        where: { anonId_assignmentId: { anonId: me, assignmentId: id } },
        select: { status: true, attemptCount: true, gradedAt: true, submittedAt: true },
    });

    const graded = !!existing?.gradedAt;

    // guard rails
    if ((action === "UNSUBMIT" || action === "RESUBMIT") && graded) {
        return jsonErr("Already graded — ask your teacher to reopen", 400);
    }

    const now = new Date();
    const due = a.dueDate ? new Date(a.dueDate) : null;
    const afterDue = !!(due && now > due);
    if ((action === "SUBMIT" || action === "RESUBMIT") && afterDue && !a.allowLate) {
        return jsonErr("Past due — late submissions are not allowed", 400);
    }

    // compute new attempt count
    const nextAttempts =
        action === "RESUBMIT"
            ? (existing?.attemptCount ?? 0) + 1
            : (existing ? existing.attemptCount ?? 0 : 1); // first submit starts at 1

    const markLate = !!(afterDue && a.allowLate);

    if (action === "UNSUBMIT") {
        const row = await prisma.assignmentcompletion.upsert({
            where: { anonId_assignmentId: { anonId: me, assignmentId: id } },
            update: {
                status: "ASSIGNED",
                submittedAt: null,
                // keep attemptCount as-is (they already attempted)
            },
            create: {
                assignmentId: id,
                anonId: me,
                status: "ASSIGNED",
                attemptCount: 0,
                attemptsJson: [],
                scorePct: null, scorePoints: null, feedback: null,
                isLate: false,
                submittedAt: null, gradedAt: null,
            },
            select: { status: true, attemptCount: true, submittedAt: true, gradedAt: true, isLate: true, feedback: true, scorePct: true, scorePoints: true },
        });
        return jsonOk(row);
    }

    // SUBMIT or RESUBMIT
    const row = await prisma.assignmentcompletion.upsert({
        where: { anonId_assignmentId: { anonId: me, assignmentId: id } },
        update: {
            status: "SUBMITTED",
            attemptCount: nextAttempts,
            submittedAt: now,
            isLate: markLate,
            // DO NOT change score/gradedAt/feedback here
        },
        create: {
            assignmentId: id,
            anonId: me,
            status: "SUBMITTED",
            attemptCount: nextAttempts,
            attemptsJson: [],
            submittedAt: now,
            isLate: markLate,
            scorePct: null, scorePoints: null, feedback: null,
            gradedAt: null,
        },
        select: {
            status: true, attemptCount: true, submittedAt: true, gradedAt: true,
            isLate: true, scorePct: true, scorePoints: true, feedback: true
        },
    });

    return jsonOk(row);
}
