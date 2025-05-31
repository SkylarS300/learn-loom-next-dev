import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function POST(req) {
  const cookieStore = await cookies();
  const anonId = cookieStore.get("learnloomId")?.value;
  if (!anonId) return new Response("Unauthorized", { status: 401 });

  const { uploadId } = await req.json();
  if (!uploadId) return new Response("Missing uploadId", { status: 400 });

  await prisma.uploadview.upsert({
    where: {
      anonId_uploadId: {
        anonId,
        uploadId,
      },
    },
    update: {
      viewedAt: new Date(),
    },
    create: {
      anonId,
      uploadId,
    },
  });

  return Response.json({ success: true });
}

export async function GET() {
  const cookieStore = await cookies();
  const anonId = cookieStore.get("learnloomId")?.value;
  if (!anonId) return new Response("Unauthorized", { status: 401 });

  const latest = await prisma.uploadview.findFirst({
    where: { anonId },
    orderBy: { viewedAt: "desc" },
    include: { uploadedtext: true },
  });

  return Response.json({ latest });
}
