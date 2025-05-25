import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    const body = await request.json();
    const { bookIndex, chapterIndex } = body;

    if (!session?.user?.id || bookIndex == null || chapterIndex == null) {
      return new Response("Missing fields", { status: 400 });
    }

    const userId = Number(session.user.id);
    const bIndex = Number(bookIndex);
    const cIndex = Number(chapterIndex);

    const alreadyLogged = await prisma.readingprogress.findFirst({
      where: {
        userId,
        bookIndex: bIndex,
        chapterIndex: cIndex,
      },
    });

    if (!alreadyLogged) {
      await prisma.readingprogress.create({
        data: {
          userId,
          bookIndex: bIndex,
          chapterIndex: cIndex,
        },
      });
    }

    return new Response("Logged", { status: 200 });
  } catch (error) {
    console.error("Reading progress error:", error);
    return new Response("Server error", { status: 500 });
  }
}
