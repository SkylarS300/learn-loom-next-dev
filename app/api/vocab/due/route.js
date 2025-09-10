//app/api/vocab/due/route.js
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";

export async function GET() {
    const c = await cookies();
    const anonId = c.get("learnloomId")?.value;
    if (!anonId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    try {
        const now = new Date();
        const rows = await prisma.wordStudy.findMany({
            where: { anonId, OR: [{ nextDue: null }, { nextDue: { lte: now } }] },
            include: { word: true },
            take: 20,
            orderBy: [{ nextDue: "asc" }, { updatedAt: "desc" }],
        });
        return NextResponse.json({
            ok: true,
            items: rows.map((r) => ({
                id: r.id,
                lemma: r.word?.lemma,
                display: r.word?.display || r.word?.lemma,
                pos: r.word?.pos || "",
                nextDue: r.nextDue,
                intervalDays: r.intervalDays ?? null,
            })),
        });
    } catch (e) {
        return NextResponse.json({ ok: false, error: "Failed" }, { status: 500 });
    }
}
