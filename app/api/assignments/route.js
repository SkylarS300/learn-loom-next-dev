import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    const {
      classroomId,
      type,
      title,
      description,
      dueDate,
      bookId,
      chapterIndex,
      quizCategory,
      quizSubtopic,
    } = await request.json();

    if (!session?.user?.id || !classroomId || !type || !title || !description) {
      return new Response("Missing required fields", { status: 400 });
    }

    const assignment = await prisma.assignment.create({
      data: {
        classroomId: Number(classroomId),
        type, // should match the enum: "BOOK", "QUIZ", "UPLOAD"
        title,
        description,
        dueDate: dueDate ? new Date(dueDate) : null,
        bookId: type === "BOOK" ? bookId : undefined,
        chapterIndex: type === "BOOK" ? chapterIndex : undefined,
        quizCategory: type === "QUIZ" ? quizCategory : undefined,
        quizSubtopic: type === "QUIZ" ? quizSubtopic : undefined,
      },
    });

    const students = await prisma.studentclassroom.findMany({
      where: { classroomId: Number(classroomId) },
    });

    await Promise.all(
      students.map((student) =>
        prisma.assignmentcompletion.create({
          data: {
            assignmentId: assignment.id,
            userId: student.studentId,
          },
        })
      )
    );

    return Response.json(assignment);
  } catch (error) {
    console.error("Assignment creation error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const classroomId = Number(searchParams.get("classroomId"));

    if (!classroomId) {
      return new Response("Missing classroomId", { status: 400 });
    }

    const assignments = await prisma.assignment.findMany({
      where: { classroomId },
      select: { id: true, title: true },
    });

    const enrollments = await prisma.studentclassroom.findMany({
      where: { classroomId },
      include: { student: true },
    });

    const completions = await prisma.assignmentcompletion.findMany({
      where: {
        assignmentId: { in: assignments.map((a) => a.id) },
        userId: { in: enrollments.map((e) => e.studentId) },
      },
    });

    const groupedByStudent = enrollments.map((enrollment) => {
      const { studentId, student } = enrollment;
      const assignmentProgress = assignments.map((assignment) => {
        const match = completions.find(
          (c) => c.assignmentId === assignment.id && c.userId === studentId
        );
        return {
          assignmentId: assignment.id,
          assignmentTitle: assignment.title,
          completed: Boolean(match?.completedAt),
        };
      });

      return {
        studentId,
        studentName: `${student.firstName} ${student.lastName}`,
        progress: assignmentProgress,
      };
    });

    return Response.json(groupedByStudent);
  } catch (error) {
    console.error("Fetch classroom progress error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
