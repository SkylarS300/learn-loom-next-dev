// app/api/classrooms/join/route.js
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

// POST /api/classrooms/join  { code, displayName?, joinAsTeacher? }
export async function POST(req) {
    const cs = await cookies();
    const anonId = cs.get("learnloomId")?.value || null;
    if (!anonId) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const rawCode = String(body?.code || "");
    const code = rawCode.trim().toUpperCase().replace(/\s+/g, "");
    const displayName = (body?.displayName || "").toString().trim().slice(0, 80) || null;
    const joinAsTeacher = !!body?.joinAsTeacher;

    if (!code) return Response.json({ ok: false, error: "Missing code" }, { status: 400 });

    const cls = await prisma.classroom.findUnique({ where: { code }, select: { id: true, ownerAnon: true } });
    if (!cls) return Response.json({ ok: false, error: "Class not found" }, { status: 404 });

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

    return Response.json({ ok: true, data: { classroomId: cls.id, role } }, { status: 200 });
}
