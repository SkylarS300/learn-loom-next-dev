// app/uploads/[id]/page.jsx
import { cookies } from "next/headers";
import UploadReader from "./UploadReader";

export default async function UploadViewPage(props) {
  const { id } = await props.params;              //  await params
  const uploadId = Number(id);
  const cookieStore = await cookies();            //  await cookies()
  const anonId = cookieStore.get("learnloomId")?.value;
  const upload = await prisma.uploadedtext.findUnique({
    where: { id },
  });

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

    if (!unlocked) {
      // Don't send content unless already unlocked
      upload.content = null;
    }
  }

  return <UploadReader upload={upload} />;
}
