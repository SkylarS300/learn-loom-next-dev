// app/api/my/classes/route.js
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export async function GET() {
    const cs = await cookies();
    const me = cs.get("learnloomId")?.value;
    if (!me) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const memberships = await prisma.studentclassroom.findMany({
        where: { anonId: me },
        select: {
            classroomId: true,
            role: true,
            classroom: { select: { name: true, code: true } },
        },
        orderBy: { id: "asc" },
    });

    // Build quick counts for student-role classes
    const now = new Date();
    const studentClassIds = memberships.filter(m => (m.role || "student") !== "teacher").map(m => m.classroomId);
    let countsByClass = new Map();
    if (studentClassIds.length) {
        const assignments = await prisma.assignment.findMany({
            where: {
                classroomId: { in: studentClassIds },
                OR: [
                    { targets: { some: { anonId: me } } },
                    { targets: { some: { anonId: null } } }, // ALL
                ],
            },
            select: { id: true, classroomId: true, dueDate: true },
        });
        const aIds = assignments.map(a => a.id);
        const comps = aIds.length ? await prisma.assignmentcompletion.findMany({
            where: { anonId: me, assignmentId: { in: aIds } },
            select: { assignmentId: true, status: true },
        }) : [];
        const compMap = new Map(comps.map(c => [c.assignmentId, c]));
        // Tally
        for (const a of assignments) {
            const s = compMap.get(a.id)?.status || "ASSIGNED";
            const due = a.dueDate ? new Date(a.dueDate) : null;
            const isMissing = due && now > due && !["SUBMITTED", "GRADED", "LATE"].includes(s);
            const bucket = isMissing ? "missing" : (["SUBMITTED", "GRADED", "LATE"].includes(s) ? "completed" : "dueSoon");
            const cur = countsByClass.get(a.classroomId) || { dueSoon: 0, missing: 0, completed: 0 };
            cur[bucket] += 1;
            countsByClass.set(a.classroomId, cur);
        }
    }

    const data = memberships.map(m => {
        const counts = countsByClass.get(m.classroomId) || { dueSoon: 0, missing: 0, completed: 0 };
        return {
            classroomId: m.classroomId,
            classroomName: m.classroom?.name || "Class",
            classroomCode: m.classroom?.code || "",
            role: m.role || "student",
            counts,
        };
    });

    return Response.json({ ok: true, data });
}
