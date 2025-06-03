import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function GET(request, context) {
  const { params } = context;
  const cookieStore = cookies();
  const anonId = cookieStore.get("learnloomId")?.value;
  const id = parseInt(params.id);

  if (!anonId || !id) return new Response("Unauthorized", { status: 401 });

  const unlocked = await prisma.uploadunlock.findUnique({
    where: {
      anonId_uploadId: {
        anonId,
        uploadId: id,
      },
    },
  });

  if (!unlocked) {
    return new Response("Forbidden", { status: 403 });
  }

  const upload = await prisma.uploadedtext.findUnique({
    where: { id },
    select: { title: true, content: true },
  });

  if (!upload) return new Response("Not found", { status: 404 });

  return Response.json(upload);
}
