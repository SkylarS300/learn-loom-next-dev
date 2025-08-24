// app/api/classrooms/[id]/live/route.js
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

async function requireTeacher(anonId, classroomId) {
    const cls = await prisma.classroom.findUnique({
        where: { id: classroomId },
        select: { id: true, ownerAnon: true },
    });
    if (!cls) return { ok: false, status: 404, error: "Not found" };
    if (cls.ownerAnon === anonId) return { ok: true, cls };
    const teacherRow = await prisma.studentclassroom.findFirst({
        where: { classroomId, anonId, role: "teacher" },
        select: { id: true },
    });
    if (!teacherRow) return { ok: false, status: 403, error: "Forbidden" };
    return { ok: true, cls };
}

// GET /api/classrooms/:id/live?minutes=5&mode=any
// mode: 'any' | 'reading' | 'grammar' | 'upload'
export async function GET(req, ctx) {
    const classroomId = Number((await ctx.params)?.id);
    if (!Number.isFinite(classroomId)) {
        return Response.json({ ok: false, error: "Bad id" }, { status: 400 });
    }

    const cs = await cookies();
    const me = cs.get("learnloomId")?.value;
    if (!me) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const auth = await requireTeacher(me, classroomId);
    if (!auth.ok) return Response.json({ ok: false, error: auth.error }, { status: auth.status });

    const url = new URL(req.url);
    const minutes = Math.max(1, Math.min(60, Number(url.searchParams.get("minutes") || 5) || 5));
    const modeRaw = String(url.searchParams.get("mode") || "any").toLowerCase();
    const mode = ["any", "reading", "grammar", "upload"].includes(modeRaw) ? modeRaw : "any";

    const roster = await prisma.studentclassroom.findMany({
        where: { classroomId },
        select: { anonId: true, displayName: true, role: true },
    });
    const anonIds = roster.map(r => r.anonId).filter(Boolean);

    const now = new Date();
    const from = new Date(now.getTime() - minutes * 60000);

    if (!anonIds.length) {
        return Response.json({
            ok: true,
            data: [],
            window: { from: from.toISOString(), to: now.toISOString() },
        });
    }

    const needReading = mode === "any" || mode === "reading";
    const needGrammar = mode === "any" || mode === "grammar";
    const needUpload = mode === "any" || mode === "upload";

    // Map UI modes to enum for heartbeat filter
    const modeEnum =
        mode === "reading" ? "READING" :
            mode === "grammar" ? "GRAMMAR" :
                mode === "upload" ? "UPLOAD" : null;

    const [reads, grams, uploads, beats] = await Promise.all([
        needReading
            ? prisma.readingprogress.findMany({
                where: { anonId: { in: anonIds }, updatedAt: { gte: from } },
                select: { anonId: true, updatedAt: true },
            })
            : Promise.resolve([]),
        needGrammar
            ? prisma.grammarprogress.findMany({
                where: { anonId: { in: anonIds }, createdAt: { gte: from } },
                select: { anonId: true, createdAt: true },
            })
            : Promise.resolve([]),
        needUpload
            ? prisma.uploadprogress.findMany({
                where: { anonId: { in: anonIds }, updatedAt: { gte: from } },
                select: { anonId: true, updatedAt: true },
            })
            : Promise.resolve([]),
        // Heartbeats (always fetched; filtered by mode if provided)
        prisma.liveheartbeat.findMany({
            where: {
                classroomId,
                updatedAt: { gte: from },
                ...(modeEnum ? { mode: modeEnum } : {}),
            },
            select: { anonId: true, updatedAt: true },
        }),
    ]);

    const lastSeen = new Map(); // anonId -> Date
    const bump = (a, t) => {
        if (!a || !t) return;
        const prev = lastSeen.get(a);
        if (!prev || t > prev) lastSeen.set(a, t);
    };

    for (const r of reads) bump(r.anonId, r.updatedAt);
    for (const g of grams) bump(g.anonId, g.createdAt);
    for (const u of uploads) bump(u.anonId, u.updatedAt);
    for (const b of beats) bump(b.anonId, b.updatedAt);

    const rosterMap = new Map(roster.map(r => [r.anonId, r]));
    const activeNow = Array.from(lastSeen.entries())
        .map(([anonId, ts]) => ({
            anonId,
            displayName: rosterMap.get(anonId)?.displayName || null,
            role: rosterMap.get(anonId)?.role || "student",
            lastSeen: ts.toISOString(),
        }))
        .sort((a, b) => (a.lastSeen < b.lastSeen ? 1 : -1));

    try {
        // eslint-disable-next-line no-console
        console.log("[live_query]", { classroomId, minutes, mode, active: activeNow.length });
    } catch { }

    return Response.json({
        ok: true,
        data: activeNow,
        window: { from: from.toISOString(), to: now.toISOString() },
    });
}
