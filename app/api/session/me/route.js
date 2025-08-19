// app/api/session/me/route.js
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function GET() {
    const cookieStore = await cookies();
    const anonId = cookieStore.get("learnloomId")?.value || null;
    if (!anonId) return Response.json({ ok: true, data: { anonId: null, shortCode: null } });

    // latest shortCode for this anonId (if any)
    const code = await prisma.userCode.findFirst({
        where: { anonId },
        orderBy: { lastUsedAt: "desc" },
    });

    return Response.json({
        ok: true,
        data: { anonId, shortCode: code?.shortCode || null },
    });
}
