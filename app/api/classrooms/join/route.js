// app/api/classrooms/join/route.js
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export async function POST(req) {
    const cs = await cookies();
    const anonId = cs.get("learnloomId")?.value;
    if (!anonId) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const { code } = await req.json().catch(() => ({}));
    const norm = String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!norm) return Response.json({ ok: false, error: "Invalid code" }, { status: 422 });

    const cls = await prisma.classroom.findUnique({ where: { code: norm } });
    if (!cls) return Response.json({ ok: false, error: "Class not found" }, { status: 404 });

    // If already member, noop
    const existing = await prisma.studentclassroom.findFirst({
        where: { classroomId: cls.id, anonId },
    });
    if (!existing) {
        await prisma.studentclassroom.create({
            data: { classroomId: cls.id, anonId, role: "student" },
        });
    }

    return Response.json({ ok: true, data: { classroomId: cls.id } });
}
