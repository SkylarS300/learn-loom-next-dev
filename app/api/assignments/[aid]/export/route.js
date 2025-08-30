// app/api/assignments/[aid]/export/route.js
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

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

async function requireTeacherByAid(anonId, aid) {
    const a = await prisma.assignment.findUnique({
        where: { id: aid },
        select: { id: true, classroomId: true, classroom: { select: { ownerAnon: true, id: true, name: true } } },
    });
    if (!a) return { ok: false, status: 404, error: "Not found" };
    if (a.classroom.ownerAnon === anonId) return { ok: true, a };
    const teacherRow = await prisma.studentclassroom.findFirst({
        where: { classroomId: a.classroomId, anonId, role: "teacher" },
        select: { id: true },
    });
    if (!teacherRow) return { ok: false, status: 403, error: "Forbidden" };
    return { ok: true, a };
}

export async function GET(_req, { params }) {
    const aid = Number(params?.aid);
    if (!Number.isFinite(aid)) return new Response("Bad id", { status: 400 });

    const cs = await cookies();
    const me = cs.get("learnloomId")?.value;
    if (!me) return new Response("Unauthorized", { status: 401 });

    const auth = await requireTeacherByAid(me, aid);
    if (!auth.ok) return new Response(auth.error || "Forbidden", { status: auth.status || 403 });

    const [a, roster, subs] = await Promise.all([
        prisma.assignment.findUnique({
            where: { id: aid },
            select: { id: true, title: true, type: true, dueDate: true, startAt: true, allowLate: true, latePenaltyPct: true, weightPoints: true, targets: { select: { anonId: true } } },
        }),
        prisma.studentclassroom.findMany({
            where: { classroomId: auth.a.classroomId, role: { not: "teacher" } },
            select: { anonId: true, displayName: true },
        }),
        prisma.assignmentcompletion.findMany({
            where: { assignmentId: aid },
            select: { anonId: true, status: true, attemptCount: true, scorePct: true, submittedAt: true, gradedAt: true, isLate: true },
        }),
    ]);

    const nameMap = new Map(roster.map(r => [r.anonId || "", r.displayName || ""]));
    const subsMap = new Map(subs.map(s => [s.anonId || "", s]));
    const targetedAll = a.targets.some(t => t.anonId == null);
    const targetedSet = targetedAll ? new Set(roster.map(r => r.anonId)) : new Set(a.targets.map(t => t.anonId));

    // Optionally load UPLOAD progress so we can include minutes + farthest paragraph
    let uploadByAnon = new Map();
    if (a.type === "UPLOAD") {
        const targeted = Array.from(targetedSet);
        try {
            const ups = await prisma.uploadprogress.findMany({
                where: { anonId: { in: targeted }, uploadId: auth.a.id ? undefined : undefined }, // leave as-is; we don't know uploadId here
            });
        } catch { /* ignore; fallback below */ }
    }
    // We need the uploadId to query correctly; fetch from assignment when type=UPLOAD
    if (a.type === "UPLOAD") {
        const assign = await prisma.assignment.findUnique({
            where: { id: aid },
            select: { uploadId: true },
        });
        if (assign?.uploadId != null) {
            try {
                const ups = await prisma.uploadprogress.findMany({
                    where: {
                        anonId: { in: Array.from(targetedSet) },
                        uploadId: Number(assign.uploadId),
                    },
                    select: { anonId: true, timeMs: true, paraIndex: true, updatedAt: true },
                });
                uploadByAnon = new Map(ups.map(u => [u.anonId, { timeMs: u.timeMs ?? null, paraIndex: u.paraIndex ?? null }]));
            } catch {
                // legacy (no timeMs)
                const ups = await prisma.uploadprogress.findMany({
                    where: {
                        anonId: { in: Array.from(targetedSet) },
                        uploadId: Number(assign.uploadId),
                    },
                    select: { anonId: true, paraIndex: true },
                });
                uploadByAnon = new Map(ups.map(u => [u.anonId, { timeMs: null, paraIndex: u.paraIndex ?? null }]));
            }
        }
    }

    const headers = ["assignmentId", "anonId", "displayName", "status", "attemptCount", "bestScorePct", "lastAttemptAt", "lateApplied", "uploadMinutes", "uploadPara", "notes"];
    const rows = Array.from(targetedSet).map(anonId => {
        const s = subsMap.get(anonId) || null;
        const up = uploadByAnon.get(anonId) || null;
        const uploadMinutes = up?.timeMs != null ? Math.max(0, Math.round((up.timeMs || 0) / 60000)) : "";
        const uploadPara = Number.isFinite(up?.paraIndex) ? up?.paraIndex : "";
        return {
            assignmentId: a.id,
            anonId,
            displayName: nameMap.get(anonId) || "",
            status: s?.status || "ASSIGNED",
            attemptCount: s?.attemptCount ?? 0,
            bestScorePct: s?.scorePct ?? "",
            lastAttemptAt: s?.gradedAt?.toISOString?.() || s?.submittedAt?.toISOString?.() || "",
            lateApplied: s?.isLate ? "1" : "0",
            uploadMinutes,
            uploadPara,
            notes: "",
        };
    });

    const csv = toCSV(headers, rows);
    return new Response(csv, {
        status: 200,
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="assignment-${a.id}.csv"`,
        },
    });
}
