// app/api/session/new/route.js
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

function genShort() {
    const A = "ABCDEFGHJKMNPQRSTUVWXZ23456789"; // no O/0/I/1
    const pick = (n) => Array.from({ length: n }, () => A[Math.floor(Math.random() * A.length)]).join("");
    return `${pick(4)}-${pick(4)}-${pick(3)}`;
}
async function mintUniqueShortCode() {
    for (let i = 0; i < 7; i++) {
        const code = genShort();
        const hit = await prisma.userCode.findUnique({ where: { shortCode: code } });
        if (!hit) return code;
    }
    throw new Error("Could not generate a unique code");
}

export async function POST() {
    const cookieStore = await cookies();
    let anonId = cookieStore.get("learnloomId")?.value;
    if (!anonId) {
        anonId = crypto.randomUUID().replace(/-/g, "");
        cookieStore.set("learnloomId", anonId, {
            path: "/",
            httpOnly: false,
            sameSite: "Lax",
            maxAge: 60 * 60 * 24 * 365 * 5, // 5y
        });
    }

    let row = await prisma.userCode.findFirst({ where: { anonId }, orderBy: { createdAt: "desc" } });
    if (!row) {
        row = await prisma.userCode.create({
            data: { anonId, shortCode: await mintUniqueShortCode() },
        });
    } else {
        await prisma.userCode.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } });
    }
    return Response.json({ ok: true, data: { anonId, shortCode: row.shortCode } });
}
