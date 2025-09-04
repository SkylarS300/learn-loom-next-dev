// app/api/admin/user/route.js
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(msg, status = 400) {
    return NextResponse.json({ ok: false, error: msg }, { status });
}

/**
 * GET /api/admin/user?code=ABCD-EFGH-123  or  ?anonId=<id>
 * Header: x-support-pass: <SUPPORT_PASS>
 */
export async function GET(req) {
    const cookie = req.headers.get("cookie") || "";
    const isAdmin = /(?:^|;\s*)adminSession=1(?:;|$)/.test(cookie);
    if (!isAdmin) return fail("Unauthorized", 401);

    const { searchParams } = new URL(req.url);
    const code = (searchParams.get("code") || "").trim().toUpperCase();
    const anonId = (searchParams.get("anonId") || "").trim();

    let uid = anonId;
    if (!uid && code) {
        const uc = await prisma.userCode.findUnique({ where: { shortCode: code }, select: { anonId: true } });
        if (!uc) return fail("Code not found", 404);
        uid = uc.anonId;
    }
    if (!uid) return fail("Missing code or anonId", 400);

    // Gather a compact support view (non-sensitive)
    const [codes, classes, notesCount, gpRecent, rpRecent] = await Promise.all([
        prisma.userCode.findMany({
            where: { anonId: uid },
            orderBy: { createdAt: "desc" },
            select: { shortCode: true, createdAt: true, lastUsedAt: true },
            take: 10,
        }),
        prisma.studentclassroom.findMany({
            where: { anonId: uid },
            orderBy: { id: "desc" },
            select: { classroomId: true, role: true, displayName: true },
            take: 20,
        }),
        prisma.note.count({ where: { anonId: uid } }),
        prisma.grammarprogress.findMany({
            where: { anonId: uid },
            orderBy: { createdAt: "desc" },
            select: { concept: true, subTopic: true, score: true, createdAt: true },
            take: 10,
        }),
        prisma.readingprogress.findMany({
            where: { anonId: uid },
            orderBy: { updatedAt: "desc" },
            select: { bookIndex: true, chapterIndex: true, updatedAt: true },
            take: 10,
        }),
    ]);

    return NextResponse.json({
        ok: true,
        data: {
            anonId: uid,
            shortCodes: codes,
            classes,
            notesCount,
            recentGrammar: gpRecent,
            recentReading: rpRecent,
        },
    });
}
