import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "../../../lib/prisma";

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    const body = await request.json();

    const userId = Number(session?.user?.id);
    const role = session?.user?.role;

    // Quiz progress logging (from /grammar)
    if (body.score !== undefined) {
      const { category, subtopic, score } = body;

      if (!userId || !category || !subtopic || score == null) {
        return new Response("Missing quiz progress fields", { status: 400 });
      }

      // 1. Log quiz progress
      await prisma.quizprogress.create({
        data: { userId, category, subtopic, score },
      });

      // 2. Find all matching assignments (QUIZ) in student classrooms
      const classrooms = await prisma.studentclassroom.findMany({
        where: { studentId: userId },
        select: { classroomId: true },
      });

      const classroomIds = classrooms.map((c) => c.classroomId);

      const matchingAssignments = await prisma.assignment.findMany({
        where: {
          type: "QUIZ",
          quizCategory: category,
          quizSubtopic: subtopic,
          classroomId: { in: classroomIds },
        },
        select: { id: true },
      });

      const assignmentIds = matchingAssignments.map((a) => a.id);

      await Promise.all(
        assignmentIds.map(async (assignmentId) => {
          const existing = await prisma.assignmentcompletion.findFirst({
            where: { userId, assignmentId },
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
                userId,
                assignmentId,
                completedAt: new Date(),
                quizScore: score,
              },
            });
          }
        })
      );

      return new Response("Quiz progress logged", { status: 200 });
    }

    // Assignment creation (by TEACHER)
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

    if (!userId || role !== "TEACHER" || !title || !description || !type || !classroomId) {
      return new Response("Missing required fields for assignment creation", { status: 400 });
    }

    // Create assignment
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

    // Auto-create blank completions for enrolled students
    const students = await prisma.studentclassroom.findMany({
      where: { classroomId },
      select: { studentId: true },
    });

    await Promise.all(
      students.map(({ studentId }) =>
        prisma.assignmentcompletion.create({
          data: {
            assignmentId: newAssignment.id,
            userId: studentId,
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
