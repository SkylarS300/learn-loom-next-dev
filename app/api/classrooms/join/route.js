// app/api/classrooms/join/route.js
import prisma from "@/lib/prisma";
import { z } from "zod";
import { getAnonId, jsonOk, jsonErr } from "@/app/api/_util/auth";

// POST /api/classrooms/join  { code, displayName?, joinAsTeacher? }
export async function POST(req) {
    const anonId = await getAnonId();
    if (!anonId) return jsonErr("Unauthorized", 401);

    const Body = z.object({
        code: z.string().trim().min(1).max(16),
        displayName: z.string().trim().max(80).optional(),
        joinAsTeacher: z.boolean().optional(),
    });
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return jsonErr("Invalid request", 400, { issues: parsed.error.issues });
    const rawCode = parsed.data.code || "";
    const code = rawCode.trim().toUpperCase().replace(/\s+/g, "");
    const displayName = parsed.data.displayName?.trim() || null;
    const joinAsTeacher = !!parsed.data.joinAsTeacher;

    if (!code) return jsonErr("Missing code", 400);

    const cls = await prisma.classroom.findUnique({ where: { code }, select: { id: true, ownerAnon: true } });
    if (!cls) return jsonErr("Class not found", 404);

    const role = joinAsTeacher ? "teacher" : "student";

    // If already in roster, just update display name if provided
    const existing = await prisma.studentclassroom.findFirst({
        where: { classroomId: cls.id, anonId },
        select: { id: true, role: true },
    });

    if (!existing) {
        await prisma.studentclassroom.create({
            data: { classroomId: cls.id, anonId, role, displayName },
        });
    } else if (displayName) {
        await prisma.studentclassroom.update({
            where: { id: existing.id },
            data: { displayName },
        });
    }

    return jsonOk({ classroomId: cls.id, role });
}
