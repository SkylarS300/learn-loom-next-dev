// app/api/classrooms/[id]/metrics/export/route.js
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import JSZip from "jszip";

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

export async function GET(req, { params }) {
    const { id } = await ctx.params; // ✅
    const num = Number(id);
    if (!Number.isFinite(id)) return new Response("Bad id", { status: 400 });

    const url = new URL(req.url);
    const to = url.searchParams.get("to") ? new Date(url.searchParams.get("to")) : new Date();
    const from = url.searchParams.get("from")
        ? new Date(url.searchParams.get("from"))
        : new Date(to.getTime() - 30 * 86400000);

    const cs = await cookies();
    const anonId = cs.get("learnloomId")?.value;
    if (!anonId) return new Response("Unauthorized", { status: 401 });

    const cls = await prisma.classroom.findUnique({
        where: { id },
        select: { ownerAnon: true, id: true, name: true },
    });
    if (!cls) return new Response("Not found", { status: 404 });

    const teacherRow = await prisma.studentclassroom.findFirst({
        where: { classroomId: id, anonId, role: "teacher" },
    });
    // Teacher-only export
    if (!(cls.ownerAnon === anonId || teacherRow)) return new Response("Forbidden", { status: 403 });

    // Roster (class-scoped; include displayName only, no global PII)
    const members = await prisma.studentclassroom.findMany({
        where: { classroomId: id },
        select: { anonId: true, role: true, displayName: true },
        orderBy: [{ role: "asc" }, { id: "asc" }],
    });

    const rosterCSV = toCSV(
        ["anonId", "role", "displayName"],
        members.map((m) => ({
            anonId: m.anonId || "",
            role: m.role || "student",
            displayName: m.displayName || "",
        }))
    );

    // Assignments in this class
    const assignments = await prisma.assignment.findMany({
        where: { classroomId: id },
        select: {
            id: true,
            title: true,
            description: true,
            type: true,
            startAt: true,
            dueDate: true,
            allowLate: true,
            latePenaltyPct: true,
            weightPoints: true,
            category: true,
            subtopic: true,
            bookId: true,
            chapterIndex: true,
            uploadId: true,
            createdAt: true,
        },
        orderBy: { id: "asc" },
    });

    const assignmentsCSV = toCSV(
        [
            "assignmentId",
            "title",
            "type",
            "startAt",
            "dueDate",
            "allowLate",
            "latePenaltyPct",
            "weightPoints",
            "category",
            "subtopic",
            "bookId",
            "chapterIndex",
            "uploadId",
            "createdAt",
        ],
        assignments.map((a) => ({
            assignmentId: a.id,
            title: a.title,
            type: a.type,
            startAt: a.startAt ? a.startAt.toISOString() : "",
            dueDate: a.dueDate ? a.dueDate.toISOString() : "",
            allowLate: a.allowLate ? "1" : "0",
            latePenaltyPct: a.latePenaltyPct ?? "",
            weightPoints: a.weightPoints ?? "",
            category: a.category ?? "",
            subtopic: a.subtopic ?? "",
            bookId: a.bookId ?? "",
            chapterIndex: a.chapterIndex ?? "",
            uploadId: a.uploadId ?? "",
            createdAt: a.createdAt?.toISOString?.() || "",
        }))
    );

    // Submissions for this class (assignmentcompletion) with displayName join
    const completions = await prisma.assignmentcompletion.findMany({
        where: { assignment: { classroomId: id }, OR: [{ anonId: { not: null } }, { userId: { not: null } }] },
        select: {
            assignmentId: true,
            anonId: true,
            status: true,
            completedAt: true,
            submittedAt: true,
            gradedAt: true,
            quizScore: true,
            scorePct: true,
            scorePoints: true,
            attemptCount: true,
            isLate: true,
            feedback: true,
            assignment: { select: { title: true, type: true, dueDate: true, weightPoints: true } },
        },
        orderBy: [{ gradedAt: "desc" }, { submittedAt: "desc" }, { completedAt: "desc" }],
    });

    const nameMap = new Map(members.map((m) => [m.anonId || "", m.displayName || ""]));
    const submissionsCSV = toCSV(
        [
            "assignmentId",
            "assignmentTitle",
            "type",
            "anonId",
            "displayName",
            "status",
            "scorePct",
            "scorePoints",
            "attemptCount",
            "isLate",
            "submittedAt",
            "gradedAt",
            "completedAt",
            "dueDate",
            "weightPoints",
            "feedback",
        ],
        completions.map((c) => ({
            assignmentId: c.assignmentId,
            assignmentTitle: c.assignment?.title || "",
            type: c.assignment?.type || "",
            anonId: c.anonId || "",
            displayName: nameMap.get(c.anonId || "") || "",
            status: c.status,
            scorePct: c.scorePct ?? c.quizScore ?? "",
            scorePoints: c.scorePoints ?? "",
            attemptCount: c.attemptCount ?? 0,
            isLate: c.isLate ? "1" : "0",
            submittedAt: c.submittedAt ? c.submittedAt.toISOString() : "",
            gradedAt: c.gradedAt ? c.gradedAt.toISOString() : "",
            completedAt: c.completedAt ? c.completedAt.toISOString() : "",
            dueDate: c.assignment?.dueDate ? c.assignment.dueDate.toISOString() : "",
            weightPoints: c.assignment?.weightPoints ?? "",
            feedback: c.feedback ?? "",
        }))
    );

    // Overview (counts + window)
    const overviewCSV = toCSV(
        ["classroomId", "classroomName", "from", "to", "students", "assignments", "submissions"],
        [
            {
                classroomId: cls.id,
                classroomName: cls.name,
                from: from.toISOString(),
                to: to.toISOString(),
                students: members.filter((m) => (m.role || "student") !== "teacher").length,
                assignments: assignments.length,
                submissions: completions.length,
            },
        ]
    );

    // ZIP (final)
    const zip = new JSZip();
    zip.file("class_overview.csv", overviewCSV);
    zip.file("roster.csv", rosterCSV);
    zip.file("assignments.csv", assignmentsCSV);
    zip.file("submissions.csv", submissionsCSV);

    const buf = await zip.generateAsync({ type: "nodebuffer" });

    return new Response(buf, {
        status: 200,
        headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="class-${cls.id}-admin.zip"`,
        },
    });
}
