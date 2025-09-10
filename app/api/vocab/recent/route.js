// app/api/vocab/recent/route.js
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const cs = await cookies();
        const anonId = cs.get("learnloomId")?.value || null;
        if (!anonId) {
            return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }

        // Pull recent encounters with their word (most recent first)
        const rows = await prisma.wordEncounter.findMany({
            where: { anonId },
            include: { word: true },
            orderBy: { createdAt: "desc" },
            take: 10,
        });

        const items = rows.map((r) => ({
            word: r.word?.display || r.word?.lemma || "",
            lemma: r.word?.lemma || "",
            pos: r.word?.pos || "",
            lastSeenAt: r.createdAt,
        }));

        return Response.json({ ok: true, data: items });
    } catch (e) {
        return Response.json(
            { ok: false, error: "RECENT_VOCAB_FAILED", detail: String(e?.message || e) },
            { status: 500 }
        );
    }
}
