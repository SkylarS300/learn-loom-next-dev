import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function POST(request) {
  try {
    const cookieStore = cookies();
    const anonId = cookieStore.get("learnloomId")?.value;
    const body = await request.json();

    if (!anonId) {
      return new Response("Missing anonId", { status: 401 });
    }

    // === QUIZ PROGRESS LOGGING ===
    if (body.score !== undefined) {
      const { category, subtopic, score } = body;

      if (!category || !subtopic || score == null) {
        return new Response("Missing quiz progress fields", { status: 400 });
      }

      // 1. Log quiz progress
      await prisma.quizprogress.create({
        data: { anonId, category, subtopic, score },
      });

      // 2. Get joined classrooms
      const classrooms = await prisma.studentclassroom.findMany({
        where: { anonId },
        select: { classroomId: true },
      });

      const classroomIds = classrooms.map((c) => c.classroomId);

      const matchingAssignments = await prisma.assignment.findMany({
        where: {
          type: "QUIZ",
          category,
          subtopic,
          classroomId: { in: classroomIds },
        },
        select: { id: true },
      });

      const assignmentIds = matchingAssignments.map((a) => a.id);

      await Promise.all(
        assignmentIds.map(async (assignmentId) => {
          const existing = await prisma.assignmentcompletion.findFirst({
            where: { anonId, assignmentId },
          });

          if (existing) {
            if (!existing.completedAt) {
              await prisma.assignmentcompletion.update({
                where: { id: existing.id },
                data: { completedAt: new Date(), quizScore: score },
              });
            }
          } else {
            await prisma.assignmentcompletion.create({
              data: {
                assignmentId,
                anonId,
                completedAt: new Date(),
                quizScore: score,
              },
            });
          }
        })
      );

      return new Response("Quiz progress logged", { status: 200 });
    }

    // === ASSIGNMENT CREATION ===
    const {
      title,
      description,
      type,
      classroomId,
      dueDate,
      bookId,
      chapterIndex,
      category,
      subtopic,
    } = body;

    if (!title || !description || !type || !classroomId) {
      return new Response("Missing required fields for assignment creation", { status: 400 });
    }

    const newAssignment = await prisma.assignment.create({
      data: {
        title,
        description,
        type,
        classroomId,
        dueDate: dueDate ? new Date(dueDate) : null,
        bookId: type === "BOOK" ? bookId : null,
        chapterIndex: type === "BOOK" ? chapterIndex : null,
        category: type === "QUIZ" ? category : null,
        subtopic: type === "QUIZ" ? subtopic : null,
      },
    });

    // Auto-create blank completions for existing joined users
    const students = await prisma.studentclassroom.findMany({
      where: { classroomId },
      select: { anonId: true },
    });

    await Promise.all(
      students.map(({ anonId }) =>
        prisma.assignmentcompletion.create({
          data: {
            assignmentId: newAssignment.id,
            anonId,
          },
        })
      )
    );

    return new Response("Assignment created", { status: 200 });
  } catch (error) {
    console.error("Assignment POST error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
