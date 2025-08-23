// app/api/classrooms/route.js
import prisma from "@/lib/prisma";
import { z } from "zod";
import { getAnonId, jsonOk, jsonErr } from "@/app/api/_util/auth";

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
    const anonId = await getAnonId();
    if (!anonId) return jsonErr("Unauthorized", 401);

    const Body = z.object({ name: z.string().trim().min(1).max(120) });
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return jsonErr("Missing or invalid name", 400, { issues: parsed.error.issues });
    const name = normalizeName(parsed.data.name);

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

        return jsonOk(cls, 201);
    } catch (e) {
        return jsonErr(e.message || "Failed to create", 500);
    }
}
