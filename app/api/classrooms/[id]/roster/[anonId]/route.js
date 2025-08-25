// app/api/classrooms/[id]/roster/[anonId]/route.js
import prisma from "@/lib/prisma";
import { z } from "zod";
import { assertTeacher, getAnonId, jsonOk, jsonErr } from "@/app/api/_util/auth";

// PATCH: update displayName; owner may also change role
export async function PATCH(req, ctx) {
    const { id, anonId } = await ctx.params;
    const classId = Number(id);
    const targetAnon = String(anonId || "");
    if (!Number.isFinite(classId) || !targetAnon) return jsonErr("Bad params", 400);

    const me = await getAnonId();
    if (!me) return jsonErr("Unauthorized", 401);

    const Body = z.object({
        displayName: z.string().trim().max(80).optional(),
        role: z.enum(["student", "teacher"]).optional(),
    });
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return jsonErr("Invalid body", 400, { issues: parsed.error.issues });
    const { displayName, role } = parsed.data;

    // Find class + ownership
    const cls = await prisma.classroom.findUnique({
        where: { id: classId },
        select: { ownerAnon: true },
    });
    if (!cls) return jsonErr("Classroom not found", 404);

    const isOwner = cls.ownerAnon === me;

    // Allow:
    // - owner/teachers to edit any student's displayName
    // - only owner can change role
    // - student may edit *their own* displayName (and only that)
    let canProceed = false;
    if (isOwner) {
        canProceed = true;
    } else if (me === targetAnon && typeof displayName === "string" && role === undefined) {
        canProceed = true;
    } else {
        try {
            await assertTeacher(classId, me);
            if (role !== undefined && !isOwner) return jsonErr("Only the owner can change roles", 403);
            canProceed = true;
        } catch (e) {
            return jsonErr(e.message || "Forbidden", e.status || 403);
        }
    }

    if (!canProceed) return jsonErr("Forbidden", 403);

    // Make sure the membership exists
    const membership = await prisma.studentclassroom.findFirst({
        where: { classroomId: classId, anonId: targetAnon },
        select: { id: true, role: true },
    });
    if (!membership) return jsonErr("Not found", 404);

    // Prevent role changes on the owner row (if present in roster)
    if (role && !isOwner) return jsonErr("Only the owner can change roles", 403);

    const updated = await prisma.studentclassroom.update({
        where: { classroomId_anonId: { classroomId: classId, anonId: targetAnon } },
        data: {
            displayName: typeof displayName === "string" ? displayName.trim() : undefined,
            role: role || undefined,
        },
        select: { anonId: true, displayName: true, role: true },
    });

    return jsonOk(updated);
}

// DELETE: remove a student from the class (teachers can remove students; cannot remove teachers)
export async function DELETE(_req, ctx) {
    const { id, anonId } = await ctx.params;
    const classId = Number(id);
    const targetAnon = String(anonId || "");
    if (!Number.isFinite(classId) || !targetAnon) return jsonErr("Bad params", 400);

    const me = await getAnonId();
    if (!me) return jsonErr("Unauthorized", 401);

    try {
        await assertTeacher(classId, me);
    } catch (e) {
        return jsonErr(e.message || "Forbidden", e.status || 403);
    }

    const membership = await prisma.studentclassroom.findFirst({
        where: { classroomId: classId, anonId: targetAnon },
        select: { role: true },
    });
    if (!membership) return jsonErr("Not found", 404);
    if ((membership.role || "student") === "teacher") return jsonErr("Cannot remove teachers", 400);

    await prisma.studentclassroom.delete({
        where: { classroomId_anonId: { classroomId: classId, anonId: targetAnon } },
    });

    return jsonOk();
}
