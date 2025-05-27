// app/api/readingprogress/route.js

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { bookIndex, chapterIndex } = await req.json();
    const userId = Number(session.user.id); // Must be Int

    await prisma.readingprogress.upsert({
      where: {
        userId_bookIndex_chapterIndex: {
          userId,
          bookIndex,
          chapterIndex,
        },
      },
      update: {},
      create: {
        userId,
        bookIndex,
        chapterIndex,
      },
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Reading progress error:", error);
    return new Response("Server error", { status: 500 });
  }
}
