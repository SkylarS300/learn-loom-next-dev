// app/api/classrooms/route.js
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

function normalizeName(s) {
    return String(s || "").trim().slice(0, 120);
}
function genCode() {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function makeUniqueCode() {
    for (let i = 0; i < 6; i++) {
        const code = genCode();
        const exists = await prisma.classroom.findUnique({ where: { code } });
        if (!exists) return code;
    }
    throw new Error("Could not mint unique class code");
}

// POST /api/classrooms  { name }
// Creates a classroom; owner = current anonId; also joins owner as role='teacher'
export async function POST(req) {
    const cs = await cookies();
    const anonId = cs.get("learnloomId")?.value || null;
    if (!anonId) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const name = normalizeName(body?.name);
    if (!name) return Response.json({ ok: false, error: "Missing name" }, { status: 400 });

    try {
        const code = await makeUniqueCode();

        const cls = await prisma.classroom.create({
            data: {
                name,
                code,
                ownerAnon: anonId,
                // Required by Prisma schema; no FK, so store sentinel 0.
                teacherId: 0,
            },
            select: { id: true, code: true, name: true },
        });

        // Ensure owner is in roster as a teacher (idempotent)
        await prisma.studentclassroom.createMany({
            data: [{ classroomId: cls.id, anonId, role: "teacher" }],
            skipDuplicates: true,
        });

        return Response.json({ ok: true, data: cls }, { status: 201 });
    } catch (e) {
        return Response.json({ ok: false, error: e.message || "Failed to create" }, { status: 500 });
    }
}
