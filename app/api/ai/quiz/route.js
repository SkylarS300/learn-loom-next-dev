import { cookies } from "next/headers";

export async function POST(req) {
    const enabled = process.env.AI_QUIZ_ENABLED === "true";
    if (!enabled) {
        return Response.json({ ok: false, error: "AI quiz is disabled" }, { status: 501 });
    }
    // Skeleton: validate input; call your model; return questions in our standard shape
    try {
        const cookieStore = await cookies();
        const anonId = cookieStore.get("learnloomId")?.value || null;
        if (!anonId) return Response.json({ ok: false, error: "Missing anonymous ID" }, { status: 401 });
        const { text = "", concept = "", subTopic = "", difficulty = "mixed", count = 8 } = await req.json();
        // TODO: call your model here; ensure no PII; don't persist input text.
        // For now, return a placeholder error to avoid misleading users.
        return Response.json({ ok: false, error: "Generator not configured" }, { status: 501 });
    } catch (e) {
        console.error("ai/quiz POST failed:", e);
        return Response.json({ ok: false, error: "Server error" }, { status: 500 });
    }
}
