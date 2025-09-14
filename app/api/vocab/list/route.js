// GET /api/vocab/list?take=20
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0; // no caching

export async function GET(req) {
    try {
        const c = await cookies();
        const anonId = c.get("learnloomId")?.value;
        if (!anonId) {
            return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }

        const url = new URL(req.url);
        const takeParam = Number(url.searchParams.get("take"));
        const take = Math.min(50, Math.max(1, Number.isFinite(takeParam) ? takeParam : 12));

        const rows = await prisma.wordStudy.findMany({
            where: { anonId },
            orderBy: [{ nextDue: "asc" }, { createdAt: "desc" }],
            take,
            select: {
                id: true,
                anonId: true,
                wordId: true,
                nextDue: true,
                intervalDays: true,
                lastResult: true,
                ease: true,
                reps: true,
                lapses: true,
                createdAt: true,
                updatedAt: true,
                word: {
                    select: {
                        id: true,
                        lemma: true,
                        display: true,
                        pos: true,
                        cefrLevel: true,
                        // Pull ONE recent encounter for an example/context line
                        encounters: {
                            orderBy: { createdAt: "desc" },
                            take: 1,
                            select: { context: true, source: true, createdAt: true },
                        },
                    },
                },
            },
        });

        const items = rows.map((r) => ({
            studyId: r.id,
            wordId: r.word.id,
            lemma: r.word.lemma,
            display: r.word.display || r.word.lemma,
            pos: r.word.pos || null,
            cefr: r.word.cefrLevel,
            stats: {
                reps: r.reps,
                lapses: r.lapses,
                ease: r.ease,
                intervalDays: r.intervalDays,
                nextDue: r.nextDue,
                lastResult: r.lastResult,
            },
            example: r.word.encounters?.[0]?.context || null,
            source: r.word.encounters?.[0]?.source || null,
            lastSeenAt: r.word.encounters?.[0]?.createdAt || null,
        }));

        return NextResponse.json({ ok: true, items }, { headers: { "Cache-Control": "no-store" } });
    } catch (e) {
        console.error("[/api/vocab/list] failed", e);
        return NextResponse.json({ ok: false, error: "Failed" }, { status: 500 });
    }
}
