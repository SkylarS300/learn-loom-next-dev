import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
    try {
        const cs = await cookies();
        const anonId = cs.get("learnloomId")?.value || null;
        if (!anonId) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

        const { wordId, note, example } = await req.json().catch(() => ({}));
        if (!wordId) return Response.json({ ok: false, error: "Missing wordId" }, { status: 400 });

        const ws = await prisma.wordStudy.findFirst({ where: { anonId, wordId: Number(wordId) }, select: { id: true } });
        if (!ws) return Response.json({ ok: false, error: "Not found" }, { status: 404 });

        await prisma.wordStudy.update({
            where: { id: ws.id },
            data: { note: String(note || "").slice(0, 2000) || null, example: String(example || "").slice(0, 500) || null },
        });

        return Response.json({ ok: true });
    } catch (e) {
        return Response.json({ ok: false, error: "NOTE_FAILED" }, { status: 500 });
    }
}
