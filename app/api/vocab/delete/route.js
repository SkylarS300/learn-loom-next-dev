// app/api/vocab/delete/route.js
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
    try {
        const cs = await cookies();
        const anonId = cs.get("learnloomId")?.value || null;
        if (!anonId) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

        const { studyId, wordId } = await req.json().catch(() => ({}));
        if (!studyId && !wordId)
            return Response.json({ ok: false, error: "Missing studyId or wordId" }, { status: 400 });

        if (studyId) {
            const row = await prisma.wordStudy.findUnique({ where: { id: Number(studyId) } });
            if (!row || row.anonId !== anonId) return Response.json({ ok: false, error: "Not found" }, { status: 404 });
            await prisma.wordStudy.delete({ where: { id: row.id } });
        } else {
            await prisma.wordStudy.deleteMany({ where: { anonId, wordId: Number(wordId) } });
        }

        return Response.json({ ok: true });
    } catch (e) {
        return Response.json({ ok: false, error: "DELETE_FAILED" }, { status: 500 });
    }
}
