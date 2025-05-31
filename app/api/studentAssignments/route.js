import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = cookies();
  const anonId = cookieStore.get("learnloomId")?.value;

  if (!anonId) {
    return new Response("Missing anonId", { status: 400 });
  }

  const joined = await prisma.studentclassroom.findMany({
    where: { anonId },
    select: { classroomId: true },
  });

  const classroomIds = joined.map((entry) => entry.classroomId);

  if (classroomIds.length === 0) {
    return Response.json([]);
  }

  const assignments = await prisma.assignment.findMany({
    where: {
      classroomId: { in: classroomIds },
    },
    orderBy: { dueDate: "asc" },
  });

  const completions = await prisma.assignmentcompletion.findMany({
    where: { anonId },
    select: {
      assignmentId: true,
      completedAt: true,
      quizScore: true,
    },
  });

  const completionMap = new Map(
    completions.map((c) => [c.assignmentId, { completedAt: c.completedAt, quizScore: c.quizScore }])
  );

  const result = assignments.map((a) => {
    const completion = completionMap.get(a.id);
    return {
      ...a,
      completedAt: completion?.completedAt ?? null,
      quizScore: completion?.quizScore ?? null,
    };
  });

  return Response.json(result);
}
