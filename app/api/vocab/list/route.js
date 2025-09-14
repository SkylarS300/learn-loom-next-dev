// app/api/vocab/list/route.js
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
    try {
        const cs = await cookies();
        const anonId = cs.get("learnloomId")?.value || null;
        if (!anonId) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

        const url = new URL(req.url);
        const take = Math.min(50, Math.max(1, Number(url.searchParams.get("take") || 12)));

        const rows = await prisma.wordStudy.findMany({
            where: { anonId },
            orderBy: [{ nextDue: "asc" }, { createdAt: "desc" }],
            take,
            select: {
                id: true, anonId: true, wordId: true, nextDue: true, intervalDays: true, lastResult: true,
                word: { select: { id: true, lemma: true, display: true, pos: true, cefrLevel: true } },
                note: true,     // optional column (see below)
                example: true,  // optional column
            },
        });

        return Response.json({
            ok: true,
            items: rows.map(r => ({
                studyId: r.id,
                wordId: r.word?.id,
                lemma: r.word?.lemma,
                display: r.word?.display || r.word?.lemma,
                pos: r.word?.pos || "",
                cefr: r.word?.cefrLevel || "UNKNOWN",
                nextDue: r.nextDue,
                intervalDays: r.intervalDays,
                lastResult: r.lastResult || null,
                note: r.note || "",
                example: r.example || "",
            })),
        });
    } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[/api/vocab/list] failed", e);
        return Response.json({ ok: false, error: "Failed" }, { status: 500 });
    }
}
