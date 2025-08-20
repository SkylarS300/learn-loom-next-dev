// app/api/session/me/route.js
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function GET() {
    const cs = await cookies();
    const anonId = cs.get("learnloomId")?.value;

    if (!anonId) {
        // No session — do NOT mint anything here.
        return Response.json({ ok: false, error: "no_session" }, { status: 401 });
    }

    // Fetch latest short code for display, but don't create if missing.
    const uc = await prisma.userCode.findFirst({
        where: { anonId },
        orderBy: { createdAt: "desc" },
        select: { shortCode: true, createdAt: true, lastUsedAt: true },
    });

    return Response.json({
        ok: true,
        data: { anonId, shortCode: uc?.shortCode || null },
    });
}
