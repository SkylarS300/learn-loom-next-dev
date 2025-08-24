import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

// PATCH: teacher or student self can update displayName.
//        Only the class owner can change someone's role (student/teacher).
export async function PATCH(req, ctx) {
    const { id, anonId } = await ctx.params;
    const classId = Number(id);
    const targetAnon = String(anonId || "");
    if (!Number.isFinite(classId) || !targetAnon) {
        return Response.json({ ok: false, error: "Bad params" }, { status: 400 });
    }

    const cs = await cookies();
    const me = cs.get("learnloomId")?.value;
    if (!me) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : undefined;
    const reqRole = typeof body?.role === "string" ? body.role.toLowerCase() : undefined;

    // Load classroom + my membership + target membership
    const [cls, mine, theirs] = await Promise.all([
        prisma.classroom.findUnique({ where: { id: classId }, select: { ownerAnon: true } }),
        prisma.studentclassroom.findFirst({ where: { classroomId: classId, anonId: me }, select: { role: true } }),
        prisma.studentclassroom.findFirst({ where: { classroomId: classId, anonId: targetAnon }, select: { role: true } }),
    ]);
    if (!cls || !mine || !theirs) {
        return Response.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    const isOwner = cls.ownerAnon === me;
    const iAmTeacher = (mine.role || "student") === "teacher";

    // Authorize update
    //  - displayName: allowed if iAmTeacher OR target is me
    //  - role: allowed only if isOwner (cannot change own role via this route)
    if (reqRole && !isOwner) {
        return Response.json({ ok: false, error: "Only the class owner can change roles" }, { status: 403 });
    }
    if ((displayName ?? "") !== "" && !(iAmTeacher || targetAnon === me)) {
        return Response.json({ ok: false, error: "Not allowed to edit someone else's name" }, { status: 403 });
    }

    const updates = {};
    if (displayName !== undefined) updates.displayName = displayName;

    if (reqRole) {
        const newRole = reqRole === "teacher" ? "teacher" : "student";
        // prevent demoting last teacher (owner protection lite)
        if (theirs.role === "teacher" && newRole === "student") {
            const otherTeachers = await prisma.studentclassroom.count({
                where: { classroomId: classId, role: "teacher", anonId: { not: targetAnon } },
            });
            if (otherTeachers === 0 && cls.ownerAnon === targetAnon) {
                return Response.json({ ok: false, error: "Cannot demote the class owner" }, { status: 422 });
            }
        }
        updates.role = newRole;
    }

    if (!Object.keys(updates).length) {
        return Response.json({ ok: true, data: { updated: false } });
    }

    await prisma.studentclassroom.updateMany({
        where: { classroomId: classId, anonId: targetAnon },
        data: updates,
    });

    return Response.json({ ok: true, data: { updated: true } });
}

// DELETE: remove a student from a class (teachers only; cannot remove teachers)
export async function DELETE(_req, ctx) {
    const { id, anonId } = await ctx.params;
    const classId = Number(id);
    const targetAnon = String(anonId || "");
    if (!Number.isFinite(classId) || !targetAnon) {
        return Response.json({ ok: false, error: "Bad params" }, { status: 400 });
    }

    const cs = await cookies();
    const me = cs.get("learnloomId")?.value;
    if (!me) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const [mine, theirs] = await Promise.all([
        prisma.studentclassroom.findFirst({ where: { classroomId: classId, anonId: me }, select: { role: true } }),
        prisma.studentclassroom.findFirst({ where: { classroomId: classId, anonId: targetAnon }, select: { role: true } }),
    ]);

    if (!mine || !theirs) return Response.json({ ok: false, error: "Not found" }, { status: 404 });
    if ((mine.role || "student") !== "teacher") {
        return Response.json({ ok: false, error: "Teachers only" }, { status: 403 });
    }
    if ((theirs.role || "student") === "teacher") {
        return Response.json({ ok: false, error: "Cannot remove teachers here" }, { status: 403 });
    }

    await prisma.studentclassroom.deleteMany({ where: { classroomId: classId, anonId: targetAnon } });
    return Response.json({ ok: true, data: { removed: true } });
}
