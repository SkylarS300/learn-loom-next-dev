import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAnon, assertTeacher } from "@/app/api/_util/auth";

function toCSV(h, rows) { const esc = v => v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v); return [h.join(","), ...rows.map(r => h.map(k => esc(r[k])).join(","))].join("\n") + "\n"; }

export async function GET(_req, { params }) {
    try {
        const anonId = await requireAnon();
        const aid = Number(params.aid);
        const a = await prisma.assignment.findUnique({ where: { id: aid } });
        if (!a) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
        await assertTeacher(a.classroomId, anonId);

        const roster = await prisma.studentclassroom.findMany({
            where: { classroomId: a.classroomId },
            select: { anonId: true, displayName: true, role: true },
        });

        const subs = await prisma.assignmentcompletion.findMany({
            where: { assignmentId: aid },
        });

        const h = ["assignmentId", "anonId", "displayName", "status", "attemptCount", "bestScorePct", "lastAttemptAt", "lateApplied", "feedback"];
        const rows = roster
            .filter(r => r.role !== "teacher")
            .map(r => {
                const s = subs.find(x => x.anonId === r.anonId);
                return {
                    assignmentId: aid,
                    anonId: r.anonId,
                    displayName: r.displayName || "",
                    status: s?.status || "ASSIGNED",
                    attemptCount: s?.attemptCount || 0,
                    bestScorePct: s?.scorePct ?? "",
                    lastAttemptAt: s?.submittedAt ? s.submittedAt.toISOString() : "",
                    lateApplied: s?.isLate ? "true" : "false",
                    feedback: s?.feedback || "",
                };
            });

        const csv = toCSV(h, rows);
        return new NextResponse(csv, {
            status: 200,
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="assignment_${aid}.csv"`,
            },
        });
    } catch (e) {
        return NextResponse.json({ ok: false, error: e.message || "Export failed" }, { status: e.status || 500 });
    }
}
