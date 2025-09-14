// app/api/vocab/due/route.js
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    const c = await cookies();
    const anonId = c.get("learnloomId")?.value;
    if (!anonId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const now = new Date();

    // Try modern columns (nextDue, intervalDays)
    try {
        const rows = await prisma.wordStudy.findMany({
            where: { anonId, OR: [{ nextDue: null }, { nextDue: { lte: now } }] },
            select: { id: true, wordId: true, nextDue: true, intervalDays: true },
            take: 20,
            orderBy: [{ nextDue: "asc" }],
        });
        const wordIds = [...new Set(rows.map(r => r.wordId))];
        const words = await prisma.word.findMany({ where: { id: { in: wordIds } }, select: { id: true, lemma: true, display: true, pos: true } });
        const byId = new Map(words.map(w => [w.id, w]));
        const items = rows.map(r => {
            const w = byId.get(r.wordId) || {};
            return { id: r.id, lemma: w.lemma, display: w.display || w.lemma, pos: w.pos || "", nextDue: r.nextDue, intervalDays: r.intervalDays ?? null };
        });
        return NextResponse.json({ ok: true, items }, { headers: { "Cache-Control": "no-store" } });
    } catch (e) {
        // Fallback to legacy columns (dueAt, interval)
        try {
            const rows = await prisma.wordStudy.findMany({
                where: { anonId, OR: [{ dueAt: null }, { dueAt: { lte: now } }] },
                select: { id: true, wordId: true, dueAt: true, interval: true },
                take: 20,
                orderBy: [{ dueAt: "asc" }],
            });
            const wordIds = [...new Set(rows.map(r => r.wordId))];
            const words = await prisma.word.findMany({ where: { id: { in: wordIds } }, select: { id: true, lemma: true, display: true, pos: true } });
            const byId = new Map(words.map(w => [w.id, w]));
            const items = rows.map(r => {
                const w = byId.get(r.wordId) || {};
                return { id: r.id, lemma: w.lemma, display: w.display || w.lemma, pos: w.pos || "", nextDue: r.dueAt, intervalDays: r.interval ?? null };
            });
            return NextResponse.json({ ok: true, items, note: "legacy-due" }, { headers: { "Cache-Control": "no-store" } });
        } catch (e2) {
            // eslint-disable-next-line no-console
            console.error("[/api/vocab/due] failed:", e2);
            return NextResponse.json({ ok: false, error: "Failed" }, { status: 500 });
        }
    }
}
