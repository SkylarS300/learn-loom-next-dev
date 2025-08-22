// app/api/live/ping/route.js
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

// POST /api/live/ping  { classroomId, mode?("reading"|"grammar"|"upload") }
export async function POST(req) {
    const cs = await cookies();
    const anonId = cs.get("learnloomId")?.value;
    if (!anonId) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    let body = {};
    try { body = await req.json(); } catch { body = {}; }

    const classroomId = Number(body.classroomId);
    if (!Number.isFinite(classroomId)) {
        return Response.json({ ok: false, error: "Bad classroomId" }, { status: 400 });
    }

    // Must belong to this class (student or teacher)
    const membership = await prisma.studentclassroom.findFirst({
        where: { classroomId, anonId },
        select: { id: true },
    });
    if (!membership) {
        // also allow the ownerAnon
        const cls = await prisma.classroom.findUnique({
            where: { id: classroomId },
            select: { ownerAnon: true },
        });
        if (!cls || cls.ownerAnon !== anonId) {
            return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
        }
    }

    const modeRaw = String(body.mode || "").toLowerCase();
    const mode =
        modeRaw === "reading" ? "READING" :
            modeRaw === "grammar" ? "GRAMMAR" :
                modeRaw === "upload" ? "UPLOAD" : null;

    await prisma.liveheartbeat.upsert({
        where: { classroomId_anonId: { classroomId, anonId } },
        create: { classroomId, anonId, mode },
        update: { mode, updatedAt: new Date() },
    });

    return Response.json({ ok: true });
}
