import { cookies } from "next/headers";

export async function POST(req) {
    try {
        const cookieStore = await cookies();
        const anonId = cookieStore.get("learnloomId")?.value || null;
        const body = await req.json().catch(() => ({}));
        let { quizId = null, issue = "", payload = null } = body || {};
        issue = String(issue || "").trim().slice(0, 1000);
        // Truncate large payloads safely
        let payloadPreview = payload;
        try {
            const s = JSON.stringify(payload ?? "");
            payloadPreview = s.length > 5000 ? JSON.parse(s.slice(0, 5000)) : payload;
        } catch { /* ignore */ }
        if (!issue && (payloadPreview == null || payloadPreview === "")) {
            return Response.json({ ok: false, error: "No feedback provided" }, { status: 422 });
        }
        console.warn("AI feedback:", { anonId, quizId, issue, payload: payloadPreview });
        return Response.json({ ok: true });
    } catch (e) {
        console.error("ai/feedback POST failed:", e);
        return Response.json({ ok: false, error: "Server error" }, { status: 500 });
    }
}
