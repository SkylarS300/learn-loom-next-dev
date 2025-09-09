// Robust creation of a vocab entry + study seed + encounter log.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function getAnonId(cookies) {
    // Next headers give cookies via request; but for App Route we can read from headers
    // Fallback to a placeholder if missing (still store the word).
    const match = cookies?.split("; ").find((r) => r.startsWith("learnloomId="));
    return match?.split("=")[1] || "anon";
}

export const dynamic = "force-dynamic";

export async function POST(req) {
    try {
        const body = await req.json().catch(() => ({}));
        const word = String(body.word || "").trim();
        const lemma = String(body.lemma || word).trim().toLowerCase();
        const pos = String(body.pos || "unknown").toLowerCase();
        if (!word) return Response.json({ ok: false, error: "Missing word" }, { status: 400 });

        const anonId = getAnonId(req.headers.get("cookie") || "");

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

        return Response.json({ ok: true, wordId: w.id });
    } catch (e) {
        // Surface the error instead of 500 with no body—helps you debug in Network tab.
        return Response.json(
            { ok: false, error: "VOCAB_ADD_FAILED", detail: String(e?.message || e) },
            { status: 200 }
        );
    }
}