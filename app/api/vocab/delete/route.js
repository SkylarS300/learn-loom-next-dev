import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
    try {
        const cs = await cookies();
        const anonId = cs.get("learnloomId")?.value || null;
        if (!anonId) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

        const { wordId } = await req.json().catch(() => ({}));
        if (!wordId) return Response.json({ ok: false, error: "Missing wordId" }, { status: 400 });

        const ws = await prisma.wordStudy.findFirst({ where: { anonId, wordId: Number(wordId) }, select: { id: true } });
        if (!ws) return Response.json({ ok: false, error: "Not found" }, { status: 404 });

        await prisma.wordStudy.delete({ where: { id: ws.id } });
        return Response.json({ ok: true });
    } catch (e) {
        return Response.json({ ok: false, error: "DELETE_FAILED" }, { status: 500 });
    }
}
