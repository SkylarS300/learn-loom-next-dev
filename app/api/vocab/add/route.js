// Robust creation of a vocab entry + study seed + encounter log.
import { cookies } from "next/headers";
import prisma from "@/lib/prisma"; // singleton client

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req) {
    try {
        const body = await req.json().catch(() => ({}));
        const word = String(body.word || "").trim();
        const lemma = String((body.lemma || word) ?? "").trim().toLowerCase();
        const pos = String(body.pos || "unknown").trim().toLowerCase();
        if (!word) return Response.json({ ok: false, error: "Missing word" }, { status: 400 });

        // Pull anonId from cookie (App Router)
        const cs = await cookies();
        const anonId = cs.get("learnloomId")?.value || "anon";

        // Upsert Word (unique on [lemma,pos])
        const w = await prisma.word.upsert({
            where: { lemma_pos: { lemma, pos } },
            update: { display: word },
            create: {
                lemma,
                display: word,
                pos,
                cefrLevel: "UNKNOWN",
            },
        });

        // Seed/Upsert WordStudy (unique on [anonId, wordId])
        await prisma.wordStudy.upsert({
            where: { anonId_wordId: { anonId, wordId: w.id } },
            update: {},
            create: { anonId, wordId: w.id },
        });

        // Log an encounter (source LOOKUP)
        await prisma.wordEncounter.create({
            data: {
                anonId,
                wordId: w.id,
                source: "LOOKUP",
                context: body.context || null,
            },
        });

        return Response.json({ ok: true, data: { wordId: w.id } });
    } catch (e) {
        return Response.json(
            { ok: false, error: "VOCAB_ADD_FAILED", detail: String(e?.message || e) },
            { status: 500 }
        );
    }
}