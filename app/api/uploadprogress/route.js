import prisma from "@/lib/prisma";
import { cookies } from "next/headers";

export async function POST(req) {
    try {
        const cookieStore = await cookies();
        const anonId = cookieStore.get("learnloomId")?.value;
        if (!anonId) return new Response("Unauthorized", { status: 401 });

        const { uploadId, paraIndex = 0, charOffset = 0, deltaTimeMs = 0 } = await req.json(); if (!uploadId) return new Response("Missing uploadId", { status: 400 });

        try {
            await prisma.uploadprogress.upsert({
                where: { anonId_uploadId: { anonId, uploadId: Number(uploadId) } },
                update: {
                    paraIndex: Number(paraIndex),
                    charOffset: Number(charOffset),
                    // if schema has timeMs, increment it; if not, this throws and we fall back
                    ...(deltaTimeMs ? { timeMs: { increment: Math.max(0, Number(deltaTimeMs)) } } : {}),
                },
                create: {
                    anonId,
                    uploadId: Number(uploadId),
                    paraIndex: Number(paraIndex),
                    charOffset: Number(charOffset),
                    ...(deltaTimeMs ? { timeMs: Math.max(0, Number(deltaTimeMs)) } : {}),
                },
            });
        } catch {
            // legacy fallback (no timeMs column)
            await prisma.uploadprogress.upsert({
                where: { anonId_uploadId: { anonId, uploadId: Number(uploadId) } },
                update: { paraIndex: Number(paraIndex), charOffset: Number(charOffset) },
                create: { anonId, uploadId: Number(uploadId), paraIndex: Number(paraIndex), charOffset: Number(charOffset) },
            });
        }

        // Completion hook (UPLOAD)
        try {
            const memberships = await prisma.studentclassroom.findMany({
                where: { anonId, role: { not: "teacher" } },
                select: { classroomId: true },
            });
            const classIds = memberships.map((m) => m.classroomId);
            if (classIds.length) {
                const now = new Date();
                const asns = await prisma.assignment.findMany({
                    where: {
                        classroomId: { in: classIds },
                        type: "UPLOAD",
                        targets: { some: { OR: [{ anonId }, { anonId: null }] } },
                        uploadId: Number(uploadId),
                    },
                    select: { id: true, dueDate: true },
                });
                await Promise.all(
                    asns.map(async (a) => {
                        const prev = await prisma.assignmentcompletion.findUnique({
                            where: { anonId_assignmentId: { anonId, assignmentId: a.id } },
                            select: { attemptCount: true },
                        });
                        const late = !!(a.dueDate && now > a.dueDate);
                        const status = late ? "LATE" : "SUBMITTED";
                        await prisma.assignmentcompletion.upsert({
                            where: { anonId_assignmentId: { anonId, assignmentId: a.id } },
                            create: {
                                anonId,
                                assignmentId: a.id,
                                status,
                                submittedAt: now,
                                isLate: late,
                                attemptCount: 1,
                            },
                            update: {
                                status,
                                submittedAt: now,
                                isLate: late,
                                attemptCount: (prev?.attemptCount ?? 0) + 1,
                            },
                        });
                    })
                );
            }
        } catch (hookErr) {
            // eslint-disable-next-line no-console
            console.warn("[uploadprogress] completion hook failed:", hookErr);
        }

        return new Response(null, { status: 200 });
    } catch (e) {
        console.error("uploadprogress POST failed:", e);
        return new Response("Server error", { status: 500 });
    }
}

export async function GET(req) {
    try {
        const url = new URL(req.url);
        const uploadId = Number(url.searchParams.get("uploadId"));
        const cookieStore = await cookies();
        const anonId = cookieStore.get("learnloomId")?.value;

        if (!anonId || !uploadId) return new Response("Unauthorized", { status: 401 });

        let rec = null;
        try {
            rec = await prisma.uploadprogress.findUnique({
                where: { anonId_uploadId: { anonId, uploadId } },
                select: { uploadId: true, paraIndex: true, charOffset: true, updatedAt: true, timeMs: true },
            });
        } catch {
            // legacy fallback: no timeMs column
            rec = await prisma.uploadprogress.findUnique({
                where: { anonId_uploadId: { anonId, uploadId } },
                select: { uploadId: true, paraIndex: true, charOffset: true, updatedAt: true },
            });
        }

        return Response.json(rec ?? {});
    } catch (e) {
        console.error("uploadprogress GET failed:", e);
        return new Response("Server error", { status: 500 });
    }
}
