// app/api/assignments/[aid]/me/route.js
import prisma from "@/lib/prisma";
import { z } from "zod";
import { getAnonId, jsonOk, jsonErr } from "@/app/api/_util/auth";

async function requireTargetedStudent(anonId, aid) {
    const a = await prisma.assignment.findUnique({
        where: { id: aid },
        select: {
            id: true, classroomId: true, title: true, type: true,
            startAt: true, dueDate: true, allowLate: true, latePenaltyPct: true, weightPoints: true,
            category: true, subtopic: true, bookId: true, chapterIndex: true, uploadId: true,
            targets: { select: { anonId: true } },
        },
    });
    if (!a) return { ok: false, status: 404, error: "Not found" };

    const membership = await prisma.studentclassroom.findFirst({
        where: { classroomId: a.classroomId, anonId },
        select: { role: true },
    });
    if (!membership) return { ok: false, status: 403, error: "Forbidden" };
    if ((membership.role || "student") === "teacher") return { ok: false, status: 403, error: "Forbidden" };

    const isTargeted = a.targets.some((t) => t.anonId == null || t.anonId === anonId);
    if (!isTargeted) return { ok: false, status: 403, error: "Not targeted" };

    return { ok: true, a };
}

export async function GET(_req, { params }) {
    const aid = Number((await params).aid);
    if (!Number.isFinite(aid)) return jsonErr("Bad id", 400);

    const me = await getAnonId();
    if (!me) return jsonErr("Unauthorized", 401);

    const auth = await requireTargetedStudent(me, aid);
    if (!auth.ok) return jsonErr(auth.error, auth.status);

    const comp = await prisma.assignmentcompletion.findUnique({
        where: { anonId_assignmentId: { anonId: me, assignmentId: aid } },
        select: { status: true, attemptCount: true, scorePct: true, submittedAt: true, gradedAt: true, feedback: true, isLate: true },
    });

    return jsonOk({
        assignment: auth.a,
        me: comp || { status: "ASSIGNED", attemptCount: 0, scorePct: null, submittedAt: null, gradedAt: null, feedback: null, isLate: false },
    });
}

export async function PATCH(req, { params }) {
    const aid = Number((await params).aid);
    if (!Number.isFinite(aid)) return jsonErr("Bad id", 400);

    const me = await getAnonId();
    if (!me) return jsonErr("Unauthorized", 401);

    const auth = await requireTargetedStudent(me, aid);
    if (!auth.ok) return jsonErr(auth.error, auth.status);

    const Body = z.object({
        action: z.enum(["submit", "unsubmit", "resubmit"]),
    });
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return jsonErr("Invalid request", 400, { issues: parsed.error.issues });
    const { action } = parsed.data;

    const existing = await prisma.assignmentcompletion.findUnique({
        where: { anonId_assignmentId: { anonId: me, assignmentId: aid } },
        select: { status: true, gradedAt: true, attemptCount: true },
    });

    const now = new Date();
    const late = !!(auth.a.dueDate && now > new Date(auth.a.dueDate));

    if (action === "unsubmit") {
        if (!existing || existing.status !== "SUBMITTED") return jsonErr("Nothing to unsubmit", 400);
        if (existing.gradedAt) return jsonErr("Already graded", 409);
        const updated = await prisma.assignmentcompletion.update({
            where: { anonId_assignmentId: { anonId: me, assignmentId: aid } },
            data: { status: "ASSIGNED", submittedAt: null, isLate: false },
            select: { status: true, submittedAt: true, gradedAt: true, attemptCount: true, scorePct: true, feedback: true, isLate: true },
        });
        return jsonOk(updated);
    }

    // submit or resubmit
    const nextAttempt = (existing?.attemptCount || 0) + 1;
    const updated = await prisma.assignmentcompletion.upsert({
        where: { anonId_assignmentId: { anonId: me, assignmentId: aid } },
        create: {
            assignmentId: aid,
            anonId: me,
            status: "SUBMITTED",
            submittedAt: now,
            isLate: late,
            attemptCount: nextAttempt,
            attemptsJson: [],
        },
        update: {
            status: "SUBMITTED",
            submittedAt: now,
            isLate: late,
            attemptCount: nextAttempt,
        },
        select: { status: true, submittedAt: true, gradedAt: true, attemptCount: true, scorePct: true, feedback: true, isLate: true },
    });

    return jsonOk(updated);
}
