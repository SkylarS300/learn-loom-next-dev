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
    include: {
      uploadview: {
        where: { anonId },
        orderBy: { viewedAt: "desc" },
        take: 1,
      },
    },
  });

  return Response.json(
    uploads.map((u) => ({
      id: u.id,
      title: u.title,
      createdAt: u.createdAt,
      locked: !!u.password,
      viewedAt: u.uploadview[0]?.viewedAt || null,
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

export async function GET() {
  const cookieStore = await cookies();            // Next 15: await cookies()
  const anonId = cookieStore.get("learnloomId")?.value;
  if (!anonId) {
    return Response.json({ ok: false, error: "Missing anonymous ID" }, { status: 401 });
  }

  try {
    const rows = await prisma.uploadedtext.findMany({
      where: { anonId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        createdAt: true,
        password: true,   // we won’t send the value—just to derive locked flag
      },
    });
    const data = rows.map(r => ({
      id: r.id,
      title: r.title,
      createdAt: r.createdAt,
      locked: !!r.password,   // do not return content or password
    }));
    return Response.json({ ok: true, data });
  } catch (e) {
    console.error("uploadedtext GET failed:", e);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
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

  await prisma.$transaction([
    prisma.uploadview.deleteMany({ where: { uploadId: id } }),
    prisma.uploadunlock.deleteMany({ where: { uploadId: id } }),
    prisma.uploadedtext.delete({ where: { id } }),
  ]);

  return new Response("Deleted", { status: 200 });
}
