// app/api/_util/auth.ts
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export async function requireAnon() {
    const c = await cookies();
    const anonId = c.get("learnloomId")?.value || null;
    if (!anonId) throw Object.assign(new Error("Missing anonymous ID"), { status: 401 });
    return anonId;
}

export async function assertTeacher(classroomId: number, anonId: string) {
    const cls = await prisma.classroom.findUnique({ where: { id: classroomId } });
    if (!cls) throw Object.assign(new Error("Classroom not found"), { status: 404 });
    const isOwner = cls.ownerAnon && cls.ownerAnon === anonId;
    const member = await prisma.studentclassroom.findFirst({
        where: { classroomId, anonId, role: "teacher" },
    });
    if (!isOwner && !member) {
        throw Object.assign(new Error("Forbidden"), { status: 403 });
    }
    return cls;
}
