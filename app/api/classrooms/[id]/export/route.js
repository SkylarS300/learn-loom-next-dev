import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import JSZip from "jszip";
import { requireAnon, assertTeacher } from "@/app/api/_util/auth";

function toCSV(headers, rows) {
    const esc = (v) => {
        if (v == null) return "";
        const s = String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [headers.join(","), ...rows.map(r => headers.map(h => esc(r[h])).join(","))].join("\n") + "\n";
}

export async function GET(_req, { params }) {
    try {
        const anonId = await requireAnon();
        const id = Number(params.id);
        await assertTeacher(id, anonId);

        // Roster
        const roster = await prisma.studentclassroom.findMany({
            where: { classroomId: id },
            select: { anonId: true, displayName: true, role: true },
        });

        // Window: last 7 days
        const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);

        // Per-student metrics
        const map = new Map();
        for (const r of roster) {
            map.set(r.anonId, { displayName: r.displayName || "", role: r.role, readingMin7d: 0, quizAvg7d: null, attempts7d: 0, lastSeen: "" });
        }

        if (roster.length) {
            const ids = roster.map(r => r.anonId).filter(Boolean);
            const reading = await prisma.readingprogress.groupBy({
                by: ["anonId"],
                where: { anonId: { in: ids }, updatedAt: { gte: since } },
                _sum: { timeMs: true },
            });
            for (const r of reading) {
                const m = map.get(r.anonId); if (m) m.readingMin7d = Math.round((r._sum.timeMs || 0) / 60000);
            }
            const gp = await prisma.grammarprogress.findMany({
                where: { anonId: { in: ids }, createdAt: { gte: since } },
                select: { anonId: true, score: true, createdAt: true },
            });
            const acc = new Map();
            for (const g of gp) {
                const a = acc.get(g.anonId) || { sum: 0, n: 0, last: 0 };
                a.sum += (g.score || 0); a.n += 1; a.last = Math.max(a.last, +g.createdAt);
                acc.set(g.anonId, a);
            }
            for (const [aid, a] of acc) {
                const m = map.get(aid); if (m) { m.quizAvg7d = Math.round(a.sum / Math.max(1, a.n)); m.attempts7d = a.n; m.lastSeen = new Date(a.last).toISOString(); }
            }
        }

        // Assignments + statuses
        const assignments = await prisma.assignment.findMany({ where: { classroomId: id }, orderBy: { createdAt: "desc" } });
        const completions = await prisma.assignmentcompletion.findMany({
            where: { assignmentId: { in: assignments.map(a => a.id) } },
        });

        // Build CSVs
        const classOverview = toCSV(
            ["classroomId", "classroomName", "createdAt", "totalStudents", "totalAssignments", "readingMinutes7d", "quizAvgPct7d"],
            [{
                classroomId: id,
                classroomName: `Class #${id}`,
                createdAt: "", // could add if you want
                totalStudents: roster.filter(r => r.role !== "teacher").length,
                totalAssignments: assignments.length,
                readingMinutes7d: [...map.values()].reduce((s, m) => s + (m.readingMin7d || 0), 0),
                quizAvgPct7d: (() => {
                    const vals = [...map.values()].map(m => m.quizAvg7d).filter(v => typeof v === "number");
                    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : "";
                })(),
            }]
        );

        const rosterCsv = toCSV(
            ["anonId", "displayName", "role", "readingMin7d", "quizAvg7d", "attempts7d", "lastSeen"],
            roster.map(r => ({ anonId: r.anonId, displayName: r.displayName || "", role: r.role, ...(map.get(r.anonId) || {}) }))
        );

        const assignmentsCsv = toCSV(
            ["assignmentId", "type", "title", "startAt", "dueAt", "allowLate", "latePenaltyPct", "weightPoints", "targets", "completed", "missing", "late"],
            assignments.map(a => {
                const subs = completions.filter(c => c.assignmentId === a.id);
                // Target logic: if there are explicit targets with anonId != null we count those; else whole class (excluding teachers)
                const expTargets = []; // optional enhancement later
                const totalTargets = expTargets.length || roster.filter(r => r.role !== "teacher").length;
                const stCompleted = subs.filter(s => s.status === "SUBMITTED" || s.status === "GRADED").length;
                const stLate = subs.filter(s => s.isLate).length;
                const stMissing = Math.max(0, totalTargets - stCompleted);
                return {
                    assignmentId: a.id,
                    type: a.type,
                    title: a.title,
                    startAt: a.startAt || "",
                    dueAt: a.dueDate || "",
                    allowLate: String(a.allowLate ?? true),
                    latePenaltyPct: a.latePenaltyPct ?? "",
                    weightPoints: a.weightPoints ?? "",
                    targets: expTargets.length ? "SELECTED" : "ALL",
                    completed: stCompleted,
                    missing: stMissing,
                    late: stLate,
                };
            })
        );

        const submissionsCsv = toCSV(
            ["assignmentId", "anonId", "displayName", "status", "attemptCount", "scorePct", "submittedAt", "gradedAt", "isLate", "feedback"],
            completions.map(s => {
                const dn = map.get(s.anonId || "")?.displayName || "";
                return {
                    assignmentId: s.assignmentId,
                    anonId: s.anonId || "",
                    displayName: dn,
                    status: s.status,
                    attemptCount: s.attemptCount || 0,
                    scorePct: s.scorePct ?? "",
                    submittedAt: s.submittedAt ? s.submittedAt.toISOString() : "",
                    gradedAt: s.gradedAt ? s.gradedAt.toISOString() : "",
                    isLate: String(!!s.isLate),
                    feedback: s.feedback || "",
                };
            })
        );

        const zip = new JSZip();
        zip.file("class_overview.csv", classOverview);
        zip.file("roster.csv", rosterCsv);
        zip.file("assignments.csv", assignmentsCsv);
        zip.file("submissions.csv", submissionsCsv);
        const blob = await zip.generateAsync({ type: "nodebuffer" });

        return new NextResponse(blob, {
            status: 200,
            headers: {
                "Content-Type": "application/zip",
                "Content-Disposition": 'attachment; filename="class_export.zip"',
            },
        });
    } catch (e) {
        const status = e.status || 500;
        return NextResponse.json({ ok: false, error: e.message || "Export failed" }, { status });
    }
}
