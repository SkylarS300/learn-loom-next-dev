import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const anonId = cookieStore.get("learnloomId")?.value;
  if (!anonId) return new Response("Unauthorized", { status: 401 });

  const results = await prisma.grammarprogress.findMany({
    where: { anonId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      concept: true,
      subTopic: true,
      score: true,
      createdAt: true,
    },
  });

  return Response.json(results);
}
