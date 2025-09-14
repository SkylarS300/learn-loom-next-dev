// app/api/vocab/review/route.js
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
    const c = await cookies();
    const anonId = c.get("learnloomId")?.value;
    if (!anonId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const { id, rating } = await req.json().catch(() => ({})); // again|hard|good|easy
    if (!id || !rating) return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });

    const row = await prisma.wordStudy.findUnique({ where: { id: Number(id) } });
    if (!row || row.anonId !== anonId) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    // SM-2-ish update on your schema fields
    const ease = Math.max(130, Math.min(250,
        (row.ease ?? 130) + (rating === "easy" ? 15 : rating === "good" ? 5 : rating === "hard" ? -15 : -30)
    ));
    const intervalDays = Math.max(1, Math.round(
        (row.intervalDays ?? 1) * (rating === "easy" ? 2.5 : rating === "good" ? 2.0 : rating === "hard" ? 1.2 : 1)
    ));
    const nextDue = new Date(Date.now() + intervalDays * 24 * 3600 * 1000);

    await prisma.wordStudy.update({
        where: { id: row.id },
        data: { ease, reps: (row.reps ?? 0) + 1, intervalDays, nextDue, lastResult: rating },
    });

    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
