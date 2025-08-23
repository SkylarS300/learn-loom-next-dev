// app/api/session/me/route.js
import prisma from "@/lib/prisma";
import { getAnonId, jsonOk, jsonErr } from "@/app/api/_util/auth";

export async function GET() {
    const anonId = await getAnonId();

    if (!anonId) {
        // No session — do NOT mint anything here.
        return jsonErr("no_session", 401);
    }

    // Fetch latest short code for display, but don't create if missing.
    const uc = await prisma.userCode.findFirst({
        where: { anonId },
        orderBy: { createdAt: "desc" },
        select: { shortCode: true, createdAt: true, lastUsedAt: true },
    });

    return jsonOk({ anonId, shortCode: uc?.shortCode || null });
}
