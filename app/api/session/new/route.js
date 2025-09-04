// app/api/session/new/route.js
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { jsonOk, jsonErr } from "@/app/api/_util/auth";

export const runtime = "nodejs";        // ensure Prisma runs in Node
export const dynamic = "force-dynamic"; // avoid static caching

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
    try {
        // Create anonId + shortCode
        const anonId = crypto.randomUUID().replace(/-/g, "");
        const shortCode = await mintUniqueShortCode();
        await prisma.userCode.create({ data: { anonId, shortCode } });

        // ✅ Set the session cookie here so the user is logged in immediately
        const cs = await cookies();
        cs.set("learnloomId", anonId, {
            path: "/",
            httpOnly: false,    // keep consistent with /api/session/code
            sameSite: "Lax",
            maxAge: 60 * 60 * 24 * 365 * 5,
        });

        return jsonOk({ anonId, shortCode });
    } catch (e) {
        return jsonErr(e?.message || "Failed to create code", 500);
    }
}
