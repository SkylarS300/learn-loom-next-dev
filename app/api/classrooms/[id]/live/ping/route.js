// app/api/classrooms/[id]/live/ping/route.js
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

const MODE_MAP = {
    reading: "READING",
    grammar: "GRAMMAR",
    upload: "UPLOAD",
};

export async function POST(req, { params }) {
    const classroomId = Number(params?.id);
    if (!Number.isFinite(classroomId)) {
        return Response.json({ ok: false, error: "Bad id" }, { status: 400 });
    }

    const cs = await cookies();
    const anonId = cs.get("learnloomId")?.value;
    if (!anonId) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    // Must be in this classroom (student or teacher)
    const membership = await prisma.studentclassroom.findFirst({
        where: { classroomId, anonId },
        select: { id: true },
    });
    if (!membership) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const rawMode = String(body?.mode || "").toLowerCase();
    const mode = MODE_MAP[rawMode] ?? null;

    await prisma.liveheartbeat.upsert({
        where: { classroomId_anonId: { classroomId, anonId } },
        update: { mode: mode ?? undefined }, // updatedAt auto-bumps
        create: { classroomId, anonId, mode },
    });

    return Response.json({ ok: true });
}
