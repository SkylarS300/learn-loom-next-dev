//app/api/vocab/review/route.js
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";

export async function POST(req) {
    const c = await cookies();
    const anonId = c.get("learnloomId")?.value;
    if (!anonId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const { id, rating } = await req.json().catch(() => ({})); // rating: again|hard|good|easy
    if (!id || !rating) return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
    try {
        const row = await prisma.wordstudy.findUnique({ where: { id: Number(id) } });
        if (!row || row.anonId !== anonId) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
        // SM-2-ish update using your actual columns (intervalDays/nextDue/lastResult)
        const ease0 = row.ease ?? 2.3;
        const ease = Math.max(1.3, Math.min(2.5,
            ease0 + (rating === "easy" ? 0.15 : rating === "good" ? 0.05 : rating === "hard" ? -0.15 : -0.3)
        ));
        const interval0 = row.intervalDays ?? 1;
        const intervalDays = Math.max(1, Math.round(
            interval0 * (rating === "easy" ? 2.5 : rating === "good" ? 2.0 : rating === "hard" ? 1.2 : 1.0)
        ));
        const nextDue = new Date(Date.now() + intervalDays * 24 * 3600 * 1000);
        await prisma.wordStudy.update({
            where: { id: row.id },
            data: { ease, intervalDays, nextDue, lastResult: rating },
        });
        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ ok: false, error: "Failed" }, { status: 500 });
    }
}
