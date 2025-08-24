import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export async function POST(req) {
    const cs = await cookies();
    const anonId = cs.get("learnloomId")?.value;
    if (!anonId) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const { code = "", displayName = "" } = await req.json();
    const cls = await prisma.classroom.findFirst({ where: { code: String(code).trim().toUpperCase() } });
    if (!cls) return Response.json({ ok: false, error: "Invalid code" }, { status: 404 });

    // Always join as student. Role elevation happens inside the classroom by the owner.
    const membership = await prisma.studentclassroom.upsert({
        where: { classroomId_anonId: { classroomId: cls.id, anonId } },
        create: { classroomId: cls.id, anonId, role: "student", displayName: displayName?.trim() || null },
        update: { displayName: displayName?.trim() || null },
        select: { classroomId: true },
    });

    return Response.json({ ok: true, data: membership });
}
