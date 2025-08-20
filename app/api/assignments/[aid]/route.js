// app/api/assignments/[aid]/route.js
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

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

// GET: detail + per-student table
export async function GET(_req, { params }) {
    const aid = Number(params?.aid);
    if (!Number.isFinite(aid)) return Response.json({ ok: false, error: "Bad id" }, { status: 400 });

    const cs = await cookies();
    const me = cs.get("learnloomId")?.value;
    if (!me) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const auth = await requireTeacherByAid(me, aid);
    if (!auth.ok) return Response.json({ ok: false, error: auth.error }, { status: auth.status });

    const [a, roster, subs] = await Promise.all([
        prisma.assignment.findUnique({
            where: { id: aid },
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
            where: { assignmentId: aid },
            select: {
                anonId: true, status: true, attemptCount: true, scorePct: true, gradedAt: true, submittedAt: true,
                // could add more later (best score, last attempt timestamps from attemptsJson if you store them)
            },
        }),
    ]);

    if (!a) return Response.json({ ok: false, error: "Not found" }, { status: 404 });

    const nameMap = new Map(roster.map(r => [r.anonId || "", r.displayName || ""]));
    const subMap = new Map((subs || []).map(s => [s.anonId || "", s]));

    // who is targeted?
    const targetedAll = a.targets.some(t => t.anonId == null);
    const targetedSet = targetedAll ? new Set(roster.map(r => r.anonId)) : new Set(a.targets.map(t => t.anonId));

    const table = roster
        .filter(r => targetedSet.has(r.anonId))
        .map(r => {
            const s = subMap.get(r.anonId) || null;
            return {
                anonId: r.anonId,
                displayName: r.displayName || "",
                status: s?.status || "ASSIGNED",
                attemptCount: s?.attemptCount ?? 0,
                scorePct: s?.scorePct ?? "",
                submittedAt: s?.submittedAt || "",
                gradedAt: s?.gradedAt || "",
            };
        });

    return Response.json({ ok: true, data: { assignment: a, students: table } });
}

// PATCH: grade override / feedback (simple form here)
export async function PATCH(req, { params }) {
    const aid = Number(params?.aid);
    if (!Number.isFinite(aid)) return Response.json({ ok: false, error: "Bad id" }, { status: 400 });

    const cs = await cookies();
    const me = cs.get("learnloomId")?.value;
    if (!me) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const auth = await requireTeacherByAid(me, aid);
    if (!auth.ok) return Response.json({ ok: false, error: auth.error }, { status: auth.status });

    const { anonId, status, scorePct, scorePoints, feedback, isLate } = await req.json().catch(() => ({}));
    if (!anonId) return Response.json({ ok: false, error: "Missing anonId" }, { status: 400 });

    const now = new Date();
    const updated = await prisma.assignmentcompletion.upsert({
        where: { anonId_assignmentId: { anonId, assignmentId: aid } },
        update: {
            status: status || undefined,
            scorePct: typeof scorePct === "number" ? scorePct : undefined,
            scorePoints: typeof scorePoints === "number" ? scorePoints : undefined,
            feedback: typeof feedback === "string" ? feedback : undefined,
            isLate: typeof isLate === "boolean" ? isLate : undefined,
            gradedAt: now,
        },
        create: {
            assignmentId: aid,
            anonId,
            status: status || "GRADED",
            scorePct: typeof scorePct === "number" ? scorePct : null,
            scorePoints: typeof scorePoints === "number" ? scorePoints : null,
            attemptCount: 0,
            attemptsJson: [],
            feedback: typeof feedback === "string" ? feedback : null,
            isLate: !!isLate,
            gradedAt: now,
        },
        select: { anonId: true, status: true, scorePct: true, scorePoints: true, gradedAt: true, feedback: true, isLate: true },
    });

    return Response.json({ ok: true, data: updated });
}
