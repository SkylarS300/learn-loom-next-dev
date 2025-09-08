//app/api/vocab/due/route.js
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";

export async function GET() {
    const c = await cookies();
    const anonId = c.get("learnloomId")?.value;
    if (!anonId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (!("wordstudy" in prisma)) {
        return NextResponse.json({ ok: false, error: "Vocab storage not migrated yet" }, { status: 501 });
    }
    try {
        const rows = await prisma.wordstudy.findMany({
            where: { anonId, OR: [{ dueAt: null }, { dueAt: { lte: new Date() } }] },
            include: { word: true },
            take: 20
        });
        return NextResponse.json({ ok: true, items: rows.map(r => ({ id: r.id, lemma: r.word.lemma, display: r.word.display })) });
    } catch {
        return NextResponse.json({ ok: false, error: "Failed" }, { status: 500 });
    }
}
