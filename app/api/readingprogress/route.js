// app/api/progress/route.js
import prisma from "../../../lib/prisma";

export async function POST(request) {
  const body = await request.json();
  const { osis, concept, subTopic, score } = body;

  try {
    const result = await prisma.grammarProgress.create({
      data: {
        osis,
        concept,
        subTopic,
        score,
      },
    });

    return Response.json(result);
  } catch (error) {
    console.error("Error saving progress:", error);
    return new Response("Failed to save progress", { status: 500 });
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const osis = searchParams.get("osis");

  if (!osis) {
    return new Response("Missing osis parameter", { status: 400 });
  }

  try {
    const progress = await prisma.grammarProgress.findMany({
      where: { osis: parseInt(osis) },
      orderBy: { createdAt: "desc" },
    });

    return Response.json(progress);
  } catch (error) {
    console.error("Error fetching progress:", error);
    return new Response("Failed to fetch progress", { status: 500 });
  }
}
