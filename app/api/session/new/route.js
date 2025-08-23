// app/api/session/new/route.js
import prisma from "@/lib/prisma";
import { jsonOk, jsonErr } from "@/app/api/_util/auth";

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
    // Signup-only: create a new anonId + shortCode, but DO NOT set cookie here.
    const anonId = crypto.randomUUID().replace(/-/g, "");
    const shortCode = await mintUniqueShortCode();
    await prisma.userCode.create({ data: { anonId, shortCode } });

    return jsonOk({ anonId, shortCode });
}
