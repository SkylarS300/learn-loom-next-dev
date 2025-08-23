import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getAnonId, jsonOk, jsonErr } from "@/app/api/_util/auth";

// simple backoff: lock 5 minutes after 5 bad tries; double each extra 5
function nextLock(count) {
  if (count < 5) return null;
  const stepsOver = Math.floor((count - 5) / 5); // 5,10,15...
  const minutes = 5 * Math.pow(2, stepsOver);    // 5,10,20,40...
  const until = new Date(Date.now() + minutes * 60 * 1000);
  return until;
}

const Body = z.object({
  uploadId: z.coerce.number().int().positive(),
  password: z.string().min(1).max(128),
});


export async function POST(req) {
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return jsonErr("Invalid request", 422, { issues: parsed.error.issues });
    }
    const { uploadId, password } = parsed.data;
    const anonId = await getAnonId();

    if (!anonId) return jsonErr("Unauthorized", 401);

    const upload = await prisma.uploadedtext.findUnique({
      where: { id: Number(uploadId) },
      select: { id: true, password: true },
    });
    if (!upload || !upload.password) {
      return jsonErr("Not found or not protected", 404);
    }

    // get or create attempt row
    let attempt = await prisma.uploadunlockattempt.findUnique({
      where: { anonId_uploadId: { anonId, uploadId: Number(uploadId) } },
    });

    if (attempt?.lockedUntil && attempt.lockedUntil > new Date()) {
      const ms = attempt.lockedUntil.getTime() - Date.now();
      return jsonErr(`Too many attempts. Try again in ${Math.ceil(ms / 60000)} min.`, 429);
    }

    const ok = await bcrypt.compare(password, upload.password);

    if (ok) {
      // record unlock (idempotent) + reset attempts
      await prisma.$transaction([
        prisma.uploadunlock.upsert({
          where: { anonId_uploadId: { anonId, uploadId: Number(uploadId) } },
          update: {},
          create: { anonId, uploadId: Number(uploadId) },
        }),
        prisma.uploadunlockattempt.upsert({
          where: { anonId_uploadId: { anonId, uploadId: Number(uploadId) } },
          update: { count: 0, lockedUntil: null },
          create: { anonId, uploadId: Number(uploadId), count: 0 },
        }),
      ]);
      return jsonOk();
    }

    // wrong password: increment + maybe lock
    attempt = await prisma.uploadunlockattempt.upsert({
      where: { anonId_uploadId: { anonId, uploadId: Number(uploadId) } },
      update: { count: { increment: 1 } },
      create: { anonId, uploadId: Number(uploadId), count: 1 },
    });

    const until = nextLock(attempt.count);
    if (until) {
      await prisma.uploadunlockattempt.update({
        where: { anonId_uploadId: { anonId, uploadId: Number(uploadId) } },
        data: { lockedUntil: until },
      });
    }

    return jsonErr("Incorrect password", 401);
  } catch (e) {
    console.error("unlockupload POST failed:", e);
    return jsonErr("Server error", 500);
  }
}
