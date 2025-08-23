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

    const headers = ["assignmentId", "anonId", "displayName", "status", "attemptCount", "bestScorePct", "lastAttemptAt", "lateApplied", "notes"];
    const rows = Array.from(targetedSet).map(anonId => {
        const s = subsMap.get(anonId) || null;
        return {
            assignmentId: a.id,
            anonId,
            displayName: nameMap.get(anonId) || "",
            status: s?.status || "ASSIGNED",
            attemptCount: s?.attemptCount ?? 0,
            bestScorePct: s?.scorePct ?? "",
            lastAttemptAt: s?.gradedAt?.toISOString?.() || s?.submittedAt?.toISOString?.() || "",
            lateApplied: s?.isLate ? "1" : "0",
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
