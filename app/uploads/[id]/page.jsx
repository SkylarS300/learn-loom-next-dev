// app/uploads/[id]/page.jsx
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import UploadReader from "./UploadReader";

export default async function UploadViewPage(props) {
  const { id } = await props.params;
  const uploadId = Number(id);
  const cookieStore = await cookies();            //  await cookies()
  const anonId = cookieStore.get("learnloomId")?.value;
  const upload = await prisma.uploadedtext.findUnique({ where: { id: uploadId } });

  if (!upload) {
    return <p>Upload not found.</p>;
  }

  // If password protected, check if anonId has unlocked it
  if (upload.password && anonId) {
    const unlocked = await prisma.uploadunlock.findUnique({
      where: {
        anonId_uploadId: {
          anonId,
          uploadId: upload.id,
        },
      },
    });

    // Build a serializable safe object for the client
    const safeUpload = {
      id: upload.id,
      title: upload.title,
      content: unlocked ? upload.content : null,
      password: !!upload.password,
      createdAt: upload.createdAt,
    };
    return <UploadReader upload={safeUpload} />;
  }

  // If not locked or no anonId, still avoid leaking the password hash
  const safeUpload = {
    id: upload.id,
    title: upload.title,
    content: upload.content,
    password: !!upload.password,
    createdAt: upload.createdAt,
  };
  return <UploadReader upload={safeUpload} />;
}
