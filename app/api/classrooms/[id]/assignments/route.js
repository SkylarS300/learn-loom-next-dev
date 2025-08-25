// app/api/classrooms/[id]/assignments/route.js
import prisma from "@/lib/prisma";
import { z } from "zod";
import { assertTeacher, getAnonId, jsonOk, jsonErr } from "@/app/api/_util/auth";

// GET: list assignments for class with basic computed counts
export async function GET(req, ctx) {
    const classId = Number((await ctx.params)?.id);
    if (!Number.isFinite(classId)) return jsonErr("Bad id", 400);

    const me = await getAnonId();
    if (!me) return jsonErr("Unauthorized", 401);
    try {
        await assertTeacher(classId, me);
    } catch (e) {
        return jsonErr(e.message || "Forbidden", e.status || 403);
    }

    const url = new URL(req.url);
    const Query = z.object({
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
    });
    const parsed = Query.safeParse({
        from: url.searchParams.get("from") || undefined,
        to: url.searchParams.get("to") || undefined,
    });
    if (!parsed.success) return jsonErr("Invalid query", 400, { issues: parsed.error.issues });
    const to = parsed.data.to ? new Date(parsed.data.to) : new Date();
    const from = parsed.data.from ? new Date(parsed.data.from) : new Date(to.getTime() - 30 * 86400000);

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

    return jsonOk(data);
}

// POST: create assignment + targets
export async function POST(req, { params }) {
    const { id } = await ctx.params; // ✅
    const num = Number(id);
    if (!Number.isFinite(classId)) return jsonErr("Bad id", 400);

    const me = await getAnonId();
    if (!me) return jsonErr("Unauthorized", 401);
    try {
        await assertTeacher(classId, me);
    } catch (e) {
        return jsonErr(e.message || "Forbidden", e.status || 403);
    }

    const Body = z.object({
        title: z.string().trim().min(1).max(200),
        description: z.string().max(2000).optional().default(""),
        type: z.enum(["QUIZ", "BOOK", "UPLOAD"]),
        startAt: z.string().datetime().nullable().optional(),
        dueDate: z.string().datetime().nullable().optional(),
        allowLate: z.boolean().optional().default(true),
        latePenaltyPct: z.number().min(0).max(100).nullable().optional(),
        weightPoints: z.number().min(0).nullable().optional(),
        instructions: z.string().max(4000).optional().default(""),
        attachments: z.array(z.string().max(400)).optional().default([]),
        category: z.string().max(120).nullable().optional(),
        subtopic: z.string().max(120).nullable().optional(),
        bookId: z.number().int().nullable().optional(),
        chapterIndex: z.number().int().nullable().optional(),
        uploadId: z.number().int().nullable().optional(),
        targets: z.union([z.literal("ALL"), z.array(z.string().min(1)).min(1)]).optional().default("ALL"),
    });
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return jsonErr("Missing or invalid fields", 400, { issues: parsed.error.issues });
    const {
        title, description, type,
        startAt, dueDate,
        allowLate, latePenaltyPct, weightPoints,
        instructions, attachments,
        category, subtopic,
        bookId, chapterIndex,
        uploadId, targets,
    } = parsed.data;

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

    return jsonOk({ assignmentId: created.id }, 201);
}
