// app/api/_util/auth.ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function requireAnon() {
    const c = await cookies();
    const anonId = c.get("learnloomId")?.value || null;
    if (!anonId) throw Object.assign(new Error("Missing anonymous ID"), { status: 401 });
    return anonId;
}

/**
 * Non-throwing helper to read the anon ID (or null).
 */
export async function getAnonId(): Promise<string | null> {
    const c = await cookies();
    return c.get("learnloomId")?.value || null;
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

/**
 * Uniform JSON helpers for route handlers.
 */
export function jsonOk(data?: unknown, init?: number | ResponseInit) {
    const body = data === undefined ? { ok: true } : { ok: true, data };
    return NextResponse.json(body, typeof init === "number" ? { status: init } : init);
}
export function jsonErr(error: string, status = 400, extra?: Record<string, unknown>) {
    return NextResponse.json({ ok: false, error, ...(extra || {}) }, { status });
}
