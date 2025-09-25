// app/uploads/[id]/page.jsx
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import UploadReader from "./UploadReader";

export default async function UploadViewPage(props) {
  const { id } = await props.params;
  const search = await props.searchParams;
  const uploadId = Number(id);

  const cookieStore = await cookies();
  const anonId = cookieStore.get("learnloomId")?.value;

  // read saved codes (JSON array)
  let savedCodes = [];
  try {
    const raw = cookieStore.get("shareCodes")?.value;
    if (raw) savedCodes = JSON.parse(raw);
  } catch { }
  const codeCookieSet = new Set(
    Array.isArray(savedCodes) ? savedCodes.map((s) => String(s).toUpperCase().trim()) : []
  );

  const upload = await prisma.uploadedtext.findUnique({
    where: { id: uploadId },
  });

  if (!upload) {
    return <p style={{ padding: 16 }}>Upload not found.</p>;
  }

  // Visibility enforcement
  const isOwner = !!anonId && upload.anonId === anonId;
  const shareCodeParam = (search?.code || "").toString().trim().toUpperCase();

  if (upload.visibility === "PRIVATE" && !isOwner) {
    // Hide existence for non-owners
    return <p style={{ padding: 16 }}>Upload not found.</p>;
  }

  // For CODED visibility, allow page but withhold content unless code is present
  const codeOK =
    upload.visibility !== "CODED" ||
    isOwner ||
    (!!upload.shareCode && (codeCookieSet.has(upload.shareCode) || shareCodeParam === upload.shareCode));

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
    content: upload.password && !unlocked
      ? null
      : !codeOK
        ? null
        : upload.content,
    // boolean flag – UploadReader treats truthy as "locked"
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
