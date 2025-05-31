import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

export async function POST(req) {
  const cookieStore = await cookies();
  const anonId = cookieStore.get("learnloomId")?.value;
  if (!anonId) return new Response("Unauthorized", { status: 401 });

  const { uploadId, password } = await req.json();

  if (!uploadId || !password) {
    return new Response("Missing uploadId or password", { status: 400 });
  }

  const upload = await prisma.uploadedtext.findUnique({
    where: { id: uploadId },
  });

  if (!upload || !upload.password) {
    return new Response("Upload not found or not locked", { status: 404 });
  }

  const valid = await bcrypt.compare(password, upload.password);

  if (!valid) {
    return new Response("Incorrect password", { status: 401 });
  }

  // Log unlock
  await prisma.uploadunlock.upsert({
    where: { anonId_uploadId: { anonId, uploadId } },
    update: {},
    create: { anonId, uploadId },
  });

  return new Response("Unlocked", { status: 200 });
}
