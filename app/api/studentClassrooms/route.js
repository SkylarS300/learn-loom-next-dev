import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = cookies();
  const anonId = cookieStore.get("learnloomId")?.value;

  if (!anonId) {
    return new Response("Missing anonId", { status: 400 });
  }

  const classrooms = await prisma.studentclassroom.findMany({
    where: { anonId },
    include: { classroom: true },
  });

  const result = classrooms.map((entry) => entry.classroom);
  return Response.json(result);
}

export async function POST(req) {
  const cookieStore = cookies();
  const anonId = cookieStore.get("learnloomId")?.value;
  const { code } = await req.json();

  if (!anonId || !code) {
    return new Response("Missing anonId or code", { status: 400 });
  }

  const classroom = await prisma.classroom.findUnique({
    where: { code },
  });

  if (!classroom) {
    return new Response("Classroom not found", { status: 404 });
  }

  const existing = await prisma.studentclassroom.findFirst({
    where: {
      anonId,
      classroomId: classroom.id,
    },
  });

  if (existing) {
    return new Response("Already joined", { status: 409 });
  }

  const joined = await prisma.studentclassroom.create({
    data: {
      anonId,
      classroomId: classroom.id,
    },
  });

  return Response.json(classroom);
}
