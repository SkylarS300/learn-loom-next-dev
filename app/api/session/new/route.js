// app/api/session/new/route.js
import { cookies, headers } from "next/headers";
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

        // Set normalized session cookie (matches /api/session/code)
        const cs = await cookies();
        const h = headers(); // sync in App Router
        // prefer x-forwarded-host on Vercel/proxies, fallback to host
        const host = (h.get("x-forwarded-host") || h.get("host") || "").toLowerCase();

        const useDomain = host.endsWith("learnloom.xyz") ? ".learnloom.xyz" : undefined;
        const isProd = !!useDomain;
        const secure = isProd; // allow non-secure locally

        cs.set("learnloomId", anonId, {
            path: "/",
            httpOnly: true,     // client does not need to read anonId
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 365 * 5,
            ...(useDomain ? { domain: useDomain } : {}),
            secure,
        });

        return jsonOk({ anonId, shortCode });
    } catch (e) {
        return jsonErr(e?.message || "Failed to create code", 500);
    }
}
