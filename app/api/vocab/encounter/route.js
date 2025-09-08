//app/api/vocab/encounter/route.js
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";

export async function POST(req) {
    const c = await cookies();
    const anonId = c.get("learnloomId")?.value;
    if (!anonId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const { word, lemma, context = "", source = "reading" } = await req.json().catch(() => ({}));
    if (!word) return NextResponse.json({ ok: false, error: "Missing word" }, { status: 400 });
    if (!("word" in prisma)) {
        return NextResponse.json({ ok: false, error: "Vocab storage not migrated yet" }, { status: 501 });
    }
    try {
        const w = await prisma.word.upsert({
            where: { lemma: (lemma || word).toLowerCase() },
            update: {},
            create: { lemma: (lemma || word).toLowerCase(), display: word }
        });
        await prisma.encounter.create({
            data: { anonId, wordId: w.id, source, context: context.slice(0, 240) }
        });
        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ ok: false, error: "Failed" }, { status: 500 });
    }
}
