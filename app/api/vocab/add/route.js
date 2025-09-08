//app/api/vocab/add/route.js
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";

export async function POST(req) {
    const c = await cookies();
    const anonId = c.get("learnloomId")?.value;
    if (!anonId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const { word, lemma } = await req.json().catch(() => ({}));
    if (!word) return NextResponse.json({ ok: false, error: "Missing word" }, { status: 400 });
    // NOTE: Requires vocab tables. Until migrated, respond 501 gracefully.
    if (!("word" in prisma)) {
        return NextResponse.json({ ok: false, error: "Vocab storage not migrated yet" }, { status: 501 });
    }
    try {
        const w = await prisma.word.upsert({
            where: { lemma: (lemma || word).toLowerCase() },
            update: {},
            create: { lemma: (lemma || word).toLowerCase(), display: word }
        });
        await prisma.wordstudy.upsert({
            where: { anonId_wordId: { anonId, wordId: w.id } },
            update: {},
            create: { anonId, wordId: w.id }
        });
        return NextResponse.json({ ok: true });
    } catch (e) {
        return NextResponse.json({ ok: false, error: "Failed to add" }, { status: 500 });
    }
}
