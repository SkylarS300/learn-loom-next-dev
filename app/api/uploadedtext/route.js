import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

export async function GET() {
  const cookieStore = await cookies();
  const anonId = cookieStore.get("learnloomId")?.value;
  if (!anonId) return new Response("Unauthorized", { status: 401 });

  const uploads = await prisma.uploadedtext.findMany({
    where: { anonId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      createdAt: true,
      password: true,
    },
  });

  return Response.json(
    uploads.map((u) => ({
      id: u.id,
      title: u.title,
      createdAt: u.createdAt,
      locked: !!u.password,
    }))
  );
}

export async function POST(req) {
  const cookieStore = await cookies();
  const anonId = cookieStore.get("learnloomId")?.value;
  if (!anonId) return new Response("Unauthorized", { status: 401 });

  const { title, content, password } = await req.json();

  if (!title || !content) {
    return new Response("Missing title or content", { status: 400 });
  }

  const hashed = password ? await bcrypt.hash(password, 10) : null;

  const newText = await prisma.uploadedtext.create({
    data: {
      anonId,
      title,
      content,
      password: hashed,
    },
  });

  return Response.json({ id: newText.id });
}

export async function DELETE(req) {
  const cookieStore = await cookies();
  const anonId = cookieStore.get("learnloomId")?.value;
  if (!anonId) return new Response("Unauthorized", { status: 401 });

  const { id } = await req.json();

  if (!id) return new Response("Missing ID", { status: 400 });

  const text = await prisma.uploadedtext.findUnique({
    where: { id },
  });

  if (!text || text.anonId !== anonId) {
    return new Response("Not found or not authorized", { status: 403 });
  }

  await prisma.uploadedtext.delete({ where: { id } });

  return new Response("Deleted", { status: 200 });
}
