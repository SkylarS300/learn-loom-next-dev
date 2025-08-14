// app/uploads/[id]/page.jsx
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import UploadReader from "./UploadReader";



export default async function UploadViewPage(props) {
  const { id } = await props.params;
  const search = await props.searchParams;
  const uploadId = Number(id);
  const cookieStore = await cookies();            //  await cookies()
  const anonId = cookieStore.get("learnloomId")?.value;

  // read saved codes (JSON array)
  let savedCodes = [];
  try {
    const raw = cookieStore.get("shareCodes")?.value;
    if (raw) savedCodes = JSON.parse(raw);
  } catch { }
  const codeCookieSet = new Set(Array.isArray(savedCodes) ? savedCodes.map(String) : []);

  const upload = await prisma.uploadedtext.findUnique({
    where: { id: uploadId }, // ensure number, not the raw string
  });

  if (!upload) {
    return <p>Upload not found.</p>;
  }

  // Visibility enforcement
  const isOwner = !!anonId && upload.anonId === anonId;
  const shareCodeParam = (search?.code || "").toString().trim().toUpperCase();
  if (upload.visibility === "PRIVATE" && !isOwner) {
    return <p>Upload not found.</p>; // hide existence
  }
  if (upload.visibility === "CODED" && !isOwner) {
    const cookieOK = upload.shareCode && codeCookieSet.has(upload.shareCode);
    const urlOK = upload.shareCode && shareCodeParam === upload.shareCode;
    if (!(cookieOK || urlOK)) {
      // allow page, but do not send content
      upload.content = null;
    }
  }
  // PUBLIC: allowed (content may still be password-locked)
  // Password enforcement (never leak content unless unlocked)
  let unlocked = false;
  if (upload.password && anonId) {
    const row = await prisma.uploadunlock.findUnique({
      where: { anonId_uploadId: { anonId, uploadId: upload.id } },
      select: { id: true },
    });
    unlocked = !!row;
  }

  // Build a serializable safe object for the client
  const safeUpload = {
    id: upload.id,
    title: upload.title,
    content: upload.password && !unlocked ? null : upload.content,
    password: !!upload.password,
    createdAt: upload.createdAt,
    visibility: upload.visibility,
    shareCode: upload.shareCode ?? null,
  };
  return <UploadReader upload={safeUpload} isOwner={isOwner} />;
}


export const metadata = {
  robots: { index: false, follow: false },
};