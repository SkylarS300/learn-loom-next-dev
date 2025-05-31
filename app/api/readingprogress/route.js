import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function POST(req) {
  try {
    const cookieStore = cookies();
    const anonId = cookieStore.get("learnloomId")?.value;

    if (!anonId) {
      return new Response("Missing anonId cookie", { status: 401 });
    }

    const { bookIndex, chapterIndex } = await req.json();

    // ✅ 1. Save reading progress (upsert)
    await prisma.readingprogress.upsert({
      where: {
        anonId_bookIndex_chapterIndex: {
          anonId,
          bookIndex,
          chapterIndex,
        },
      },
      update: {
        completedAt: new Date(),
      },
      create: {
        anonId,
        bookIndex,
        chapterIndex,
      },
    });

    // ✅ 2. Get student’s classroom IDs
    const studentClassrooms = await prisma.studentclassroom.findMany({
      where: { anonId },
      select: { classroomId: true },
    });

    const classroomIds = studentClassrooms.map((sc) => sc.classroomId);

    if (classroomIds.length === 0) {
      return Response.json({ success: true });
    }

    // ✅ 3. Find matching assignments
    const matchingAssignments = await prisma.assignment.findMany({
      where: {
        type: "BOOK",
        bookId: bookIndex,
        chapterIndex,
        classroomId: { in: classroomIds },
      },
      select: { id: true },
    });

    const assignmentIds = matchingAssignments.map((a) => a.id);

    // ✅ 4. POST to /api/completions/mark for each
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

    await Promise.all(
      assignmentIds.map((assignmentId) =>
        fetch(`${baseUrl}/api/completions/mark`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: req.headers.get("cookie") || "",
          },
          body: JSON.stringify({ assignmentId }),
        })
      )
    );

    return Response.json({ success: true });
  } catch (error) {
    console.error("❌ Reading progress error:", error);
    return new Response("Server error", { status: 500 });
  }
}

export async function GET() {
  const cookieStore = await cookies();
  const anonId = cookieStore.get("learnloomId")?.value;
  if (!anonId) return new Response("Unauthorized", { status: 401 });

  const progress = await prisma.readingprogress.findMany({
    where: { anonId },
    select: {
      bookIndex: true,
      chapterIndex: true,
    },
  });

  return Response.json(progress);
}

