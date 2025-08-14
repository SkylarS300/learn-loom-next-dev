import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function POST(req) {
    try {
        const cookieStore = await cookies();
        const anonId = cookieStore.get("learnloomId")?.value || null;
        const { quizId = null, issue = "", payload = null } = await req.json();
        // If you don't want DB storage yet, you can log to console and return ok.
        console.warn("AI feedback:", { anonId, quizId, issue, payload });
        return Response.json({ ok: true });
    } catch (e) {
        console.error("ai/feedback POST failed:", e);
        return Response.json({ ok: false, error: "Server error" }, { status: 500 });
    }
}
