// app/api/classrooms/[id]/assignments/route.js
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

// helper: auth as teacher/owner
async function requireTeacher(anonId, classroomId) {
    const cls = await prisma.classroom.findUnique({
        where: { id: classroomId },
        select: { id: true, ownerAnon: true },
    });
    if (!cls) return { ok: false, status: 404, error: "Not found" };
    if (cls.ownerAnon === anonId) return { ok: true, cls, isTeacher: true };
    const teacherRow = await prisma.studentclassroom.findFirst({
        where: { classroomId, anonId, role: "teacher" },
        select: { id: true },
    });
    if (!teacherRow) return { ok: false, status: 403, error: "Forbidden" };
    return { ok: true, cls, isTeacher: true };
}

// GET: list assignments for class with basic computed counts
export async function GET(req, { params }) {
    const classId = Number(params?.id);
    if (!Number.isFinite(classId)) return Response.json({ ok: false, error: "Bad id" }, { status: 400 });

    const cs = await cookies();
    const me = cs.get("learnloomId")?.value;
    if (!me) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const auth = await requireTeacher(me, classId);
    if (!auth.ok) return Response.json({ ok: false, error: auth.error }, { status: auth.status });

    const url = new URL(req.url);
    const to = url.searchParams.get("to") ? new Date(url.searchParams.get("to")) : new Date();
    const from = url.searchParams.get("from")
        ? new Date(url.searchParams.get("from"))
        : new Date(to.getTime() - 30 * 86400000);

    const [assignments, members] = await Promise.all([
        prisma.assignment.findMany({
            where: { classroomId: classId },
            orderBy: { createdAt: "desc" },
            select: {
                id: true, title: true, description: true, type: true, startAt: true, dueDate: true,
                allowLate: true, latePenaltyPct: true, weightPoints: true, category: true, subtopic: true,
                bookId: true, chapterIndex: true, uploadId: true, createdAt: true,
                targets: { select: { anonId: true } },
            },
        }),
        prisma.studentclassroom.findMany({
            where: { classroomId: classId, role: { not: "teacher" } },
            select: { anonId: true },
        }),
    ]);

    const studentAnonIds = members.map(m => m.anonId).filter(Boolean);
    const assignmentIds = assignments.map(a => a.id);
    const completions = assignmentIds.length
        ? await prisma.assignmentcompletion.findMany({
            where: { assignmentId: { in: assignmentIds }, anonId: { not: null } },
            select: { assignmentId: true, status: true, scorePct: true, attemptCount: true, gradedAt: true, submittedAt: true },
        })
        : [];

    // index completions per assignment
    const byAid = new Map();
    for (const c of completions) {
        const arr = byAid.get(c.assignmentId) || [];
        arr.push(c);
        byAid.set(c.assignmentId, arr);
    }

    // compute simple counts by status
    const data = assignments.map(a => {
        const t = a.targets?.length ? a.targets : [{ anonId: null }]; // null => ALL
        const targetedCount =
            t.some(x => x.anonId == null)
                ? studentAnonIds.length
                : t.filter(x => x.anonId).length;

        const rows = byAid.get(a.id) || [];
        const statusCounts = rows.reduce((acc, r) => {
            acc[r.status] = (acc[r.status] || 0) + 1;
            return acc;
        }, {});
        const completed = (statusCounts.SUBMITTED || 0) + (statusCounts.GRADED || 0);
        const late = statusCounts.LATE || 0;
        const missing = Math.max(0, targetedCount - (completed + late + (statusCounts.ASSIGNED || 0)));

        return {
            ...a,
            targetedCount,
            counts: {
                ASSIGNED: statusCounts.ASSIGNED || 0,
                SUBMITTED: statusCounts.SUBMITTED || 0,
                GRADED: statusCounts.GRADED || 0,
                LATE: statusCounts.LATE || 0,
                MISSING: missing,
            },
            window: { from: from.toISOString(), to: to.toISOString() },
        };
    });

    return Response.json({ ok: true, data });
}

// POST: create assignment + targets
export async function POST(req, { params }) {
    const classId = Number(params?.id);
    if (!Number.isFinite(classId)) return Response.json({ ok: false, error: "Bad id" }, { status: 400 });

    const cs = await cookies();
    const me = cs.get("learnloomId")?.value;
    if (!me) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const auth = await requireTeacher(me, classId);
    if (!auth.ok) return Response.json({ ok: false, error: auth.error }, { status: auth.status });

    const body = await req.json().catch(() => ({}));
    const {
        title, description = "", type,
        startAt = null, dueDate = null,
        allowLate = true, latePenaltyPct = null, weightPoints = null,
        instructions = "", attachments = [],
        category = null, subtopic = null,
        bookId = null, chapterIndex = null,
        uploadId = null,
        targets = "ALL", // "ALL" or array of anonIds
    } = body || {};

    if (!title || !type) {
        return Response.json({ ok: false, error: "Missing title or type" }, { status: 400 });
    }

    const created = await prisma.assignment.create({
        data: {
            classroomId: classId,
            title,
            description,
            type,
            startAt: startAt ? new Date(startAt) : null,
            dueDate: dueDate ? new Date(dueDate) : null,
            allowLate: !!allowLate,
            latePenaltyPct: latePenaltyPct ?? null,
            weightPoints: weightPoints ?? null,
            instructions: instructions || "",
            attachmentsJson: Array.isArray(attachments) ? attachments : [],
            category, subtopic,
            bookId: bookId ?? null,
            chapterIndex: chapterIndex ?? null,
            uploadId: uploadId ?? null,
        },
        select: { id: true },
    });

    // targets
    if (targets === "ALL") {
        await prisma.assignmenttarget.create({
            data: { assignmentId: created.id, anonId: null, overridesJson: {} },
        });
    } else if (Array.isArray(targets) && targets.length) {
        await prisma.assignmenttarget.createMany({
            data: targets.map(anonId => ({ assignmentId: created.id, anonId, overridesJson: {} })),
            skipDuplicates: true,
        });
    }

    return Response.json({ ok: true, data: { assignmentId: created.id } }, { status: 201 });
}
