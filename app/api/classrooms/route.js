// app/api/classrooms/route.js
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

const ABC = "ABCDEFGHJKMNPQRSTUVWXZ23456789"; // no O/0/I/1
function genCode(n = 6) {
    return Array.from({ length: n }, () => ABC[Math.floor(Math.random() * ABC.length)]).join("");
}

export async function GET() {
    const cs = await cookies();
    const anonId = cs.get("learnloomId")?.value;
    if (!anonId) return Response.json({ ok: true, data: { teaching: [], enrolled: [] } });

    // Classes I own (teacher)
    const teaching = await prisma.classroom.findMany({
        where: { ownerAnon: anonId },
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, code: true, createdAt: true },
    });

    // Classes I’m enrolled in (student)
    const memberships = await prisma.studentclassroom.findMany({
        where: { anonId },
        select: { classroomId: true },
    });
    const enrolledIds = memberships.map((m) => m.classroomId);
    const enrolled = enrolledIds.length
        ? await prisma.classroom.findMany({
            where: { id: { in: enrolledIds } },
            orderBy: { createdAt: "desc" },
            select: { id: true, name: true, code: true, createdAt: true },
        })
        : [];

    return Response.json({ ok: true, data: { teaching, enrolled } });
}

export async function POST(req) {
    const cs = await cookies();
    const anonId = cs.get("learnloomId")?.value;
    if (!anonId) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const { name } = await req.json().catch(() => ({}));
    if (!name || String(name).trim().length < 2) {
        return Response.json({ ok: false, error: "Name required" }, { status: 422 });
    }

    // Generate unique code
    let code = "";
    for (let i = 0; i < 8; i++) {
        const tryCode = genCode(6);
        const clash = await prisma.classroom.findUnique({ where: { code: tryCode } });
        if (!clash) { code = tryCode; break; }
    }
    if (!code) return Response.json({ ok: false, error: "Could not generate code" }, { status: 500 });

    const cls = await prisma.classroom.create({
        data: { name: String(name).trim(), code, teacherId: 0, ownerAnon: anonId },
        select: { id: true, name: true, code: true, createdAt: true },
    });

    // (Optional) also record a teacher membership row for easier queries
    await prisma.studentclassroom.create({
        data: { classroomId: cls.id, anonId, role: "teacher" },
    }).catch(() => { });

    return Response.json({ ok: true, data: cls });
}
