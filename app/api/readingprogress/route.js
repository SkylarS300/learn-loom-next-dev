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
        bookIndex,
        chapterIndex,
        classroomId: { in: classroomIds },
      },
      select: { id: true },
    });

    const assignmentIds = matchingAssignments.map((a) => a.id);

    if (assignmentIds.length > 0) {
      // ✅ 4. Update assignmentcompletion
      await Promise.all(
        assignmentIds.map((assignmentId) =>
          prisma.assignmentcompletion.updateMany({
            where: {
              userId,
              assignmentId,
              completedAt: null, // prevent overwriting
            },
            data: {
              completedAt: new Date(),
            },
          })
        )
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("❌ Reading progress error:", error);
    return new Response("Server error", { status: 500 });
  }
}
