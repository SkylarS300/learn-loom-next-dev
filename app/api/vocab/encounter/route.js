//app/api/vocab/encounter/route.js
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";

export async function POST(req) {
    const c = await cookies();
    const anonId = c.get("learnloomId")?.value;
    if (!anonId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const { word, lemma, context = "", source = "reading", pos = "unknown" } = await req.json().catch(() => ({}));
    if (!word) return NextResponse.json({ ok: false, error: "Missing word" }, { status: 400 });
    try {
        // Map loose client strings to enum vocab_source
        // schema enum: BOOK | UPLOAD | GRAMMAR | LOOKUP
        const src = String(source || "reading").toLowerCase();
        const sourceEnum =
            src === "reading" ? "BOOK" :
                src === "upload" ? "UPLOAD" :
                    src === "grammar" ? "GRAMMAR" :
                        "LOOKUP";

        const w = await prisma.word.upsert({
            where: { lemma_pos: { lemma: (lemma || word).toLowerCase(), pos: String(pos || "unknown").toLowerCase() } },
            update: { display: word },
            create: { lemma: (lemma || word).toLowerCase(), display: word, pos: String(pos || "unknown").toLowerCase(), cefrLevel: "UNKNOWN" }
        });
        await prisma.wordEncounter.create({
            data: { anonId, wordId: w.id, source: sourceEnum, context: String(context || "").slice(0, 240) }
        });
        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ ok: false, error: "Failed" }, { status: 500 });
    }
}
