// app/api/uploadprogress/route.js
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

// Save / update progress
export async function POST(req) {
    try {
        const cookieStore = await cookies();
        const anonId = cookieStore.get("learnloomId")?.value;
        if (!anonId) return new Response("Unauthorized", { status: 401 });

        const { uploadId, paraIndex, charOffset } = await req.json();
        const uid = Number(uploadId);

        if (!uid || paraIndex == null || charOffset == null) {
            return new Response("Missing fields", { status: 400 });
        }

        const rec = await prisma.uploadprogress.upsert({
            where: { anonId_uploadId: { anonId, uploadId: uid } },
            update: { paraIndex: Number(paraIndex), charOffset: Number(charOffset) },
            create: {
                anonId,
                uploadId: uid,
                paraIndex: Number(paraIndex),
                charOffset: Number(charOffset),
            },
            select: { uploadId: true, paraIndex: true, charOffset: true, updatedAt: true },
        });

        return Response.json(rec);
    } catch (e) {
        console.error("uploadprogress POST failed:", e);
        return new Response("Server error", { status: 500 });
    }
}

// Read progress
export async function GET(req) {
    try {
        const cookieStore = await cookies();
        const anonId = cookieStore.get("learnloomId")?.value;
        if (!anonId) return new Response("Unauthorized", { status: 401 });

        const url = new URL(req.url);
        const uploadId = Number(url.searchParams.get("uploadId"));
        if (!uploadId) return new Response("Missing uploadId", { status: 400 });

        const rec = await prisma.uploadprogress.findUnique({
            where: { anonId_uploadId: { anonId, uploadId } },
            select: { uploadId: true, paraIndex: true, charOffset: true, updatedAt: true },
        });

        return Response.json(rec ?? {});
    } catch (e) {
        console.error("uploadprogress GET failed:", e);
        return new Response("Server error", { status: 500 });
    }
}
