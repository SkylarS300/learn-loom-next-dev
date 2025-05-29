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
    const userId = Number(session.user.id);

    // ✅ 1. Save reading progress (upsert)
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

    // ✅ 2. Get student’s classroom IDs
    const studentClassrooms = await prisma.studentclassroom.findMany({
      where: { studentId: userId },
      select: { classroomId: true },
    });

    const classroomIds = studentClassrooms.map((sc) => sc.classroomId);

    if (classroomIds.length === 0) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    // ✅ 3. Find matching assignments
    const matchingAssignments = await prisma.assignment.findMany({
      where: {
        type: "BOOK",
        bookId: bookIndex, // Assuming bookIndex corresponds to bookId
        chapterIndex,
        classroomId: { in: classroomIds },
      },
      select: { id: true },
    });

    const assignmentIds = matchingAssignments.map((a) => a.id);

    // ✅ 4. POST to /api/completions/mark for each matching assignment
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

    await Promise.all(
      assignmentIds.map(async (assignmentId) => {
        await fetch(`${baseUrl}/api/completions/mark`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: req.headers.get("cookie") || "", // carry session if needed
          },
          body: JSON.stringify({ assignmentId }),
        });
      })
    );

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("❌ Reading progress error:", error);
    return new Response("Server error", { status: 500 });
  }
}
