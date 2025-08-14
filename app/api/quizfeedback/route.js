import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function POST(req) {
    try {
        const cookieStore = await cookies();
        const anonId = cookieStore.get("learnloomId")?.value || null;
        const body = await req.json();
        const concept = String(body?.concept || "").trim();
        const subTopic = String(body?.subTopic || "General").trim();
        const prompt = String(body?.prompt || "").trim();
        const issue = String(body?.issue || "").trim();
        if (!concept || !prompt || !issue) {
            return Response.json({ ok: false, error: "Missing fields" }, { status: 422 });
        }
        // Cap lengths defensively
        const MAX_PROMPT = 2000;
        const MAX_ISSUE = 4000;
        const row = await prisma.quizfeedback.create({
            data: {
                anonId,
                concept,
                subTopic,
                prompt: prompt.slice(0, MAX_PROMPT),
                issue: issue.slice(0, MAX_ISSUE),
            },
            select: { id: true, createdAt: true },
        });
        return Response.json({ ok: true, data: row });
    } catch (e) {
        console.error("quizfeedback POST failed:", e);
        return Response.json({ ok: false, error: "Server error" }, { status: 500 });
    }
}
