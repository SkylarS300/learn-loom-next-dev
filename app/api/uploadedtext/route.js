import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getAnonId, jsonOk, jsonErr } from "@/app/api/_util/auth";

// Short, URL-safe share code (e.g., 6 chars)
function genShareCode(len = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}


export async function POST(req) {
  const anonId = await getAnonId();
  if (!anonId) return jsonErr("Unauthorized", 401);

  const Body = z.object({
    title: z.string().min(1).max(200),
    content: z.string().min(1),
    password: z.string().max(128).optional(),
    visibility: z.enum(["PRIVATE", "CODED", "PUBLIC"]).optional().default("PRIVATE"),
  });
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonErr("Missing or invalid fields", 400, { issues: parsed.error.issues });
  const { title, content, password, visibility } = parsed.data;

  const hashed = password ? await bcrypt.hash(password, 10) : null;
  const vis = String(visibility).toUpperCase();
  const code = vis === "CODED" ? genShareCode() : null;


  const newText = await prisma.uploadedtext.create({
    data: {
      anonId,
      title,
      content,
      password: hashed,
      visibility: vis,
      shareCode: code
    },
  });

  // Return shareCode if generated, so user can share immediately
  return jsonOk({ id: newText.id, shareCode: newText.shareCode, visibility: newText.visibility });
}

// Unified GET (supports your uploads; or community via ?scope=public[&code=XXXX] plus saved cookie codes)
export async function GET(req) {
  const cookieStore = await cookies(); // Next 15: await cookies()
  const { searchParams } = new URL(req.url);
  const Query = z.object({
    scope: z.enum(["mine", "public"]).optional().default("mine"),
    code: z.string().trim().max(32).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional().default(24),
    cursor: z.string().trim().optional(),
  });
  const parsed = Query.safeParse({
    scope: searchParams.get("scope") || undefined,
    code: searchParams.get("code") || undefined,
    limit: searchParams.get("limit") || undefined,
    cursor: searchParams.get("cursor") || undefined,
  });
  if (!parsed.success) return jsonErr("Invalid query", 400, { issues: parsed.error.issues });
  const { scope, code: codeParamRaw, limit, cursor } = parsed.data;
  const anonId = cookieStore.get("learnloomId")?.value;

  // gather saved codes from cookie (JSON array), plus optional ?code param
  let savedCodes = [];
  try {
    const raw = cookieStore.get("shareCodes")?.value;
    if (raw) savedCodes = JSON.parse(raw);
  } catch { }
  const allCodes = new Set(
    [...(Array.isArray(savedCodes) ? savedCodes : []), ...(codeParamRaw ? [codeParamRaw] : [])]
      .map(s => String(s || "").trim().toUpperCase())
      .filter(Boolean)
  );

  try {
    // Default = "mine" (requires anon)
    if (scope !== "public" && !anonId) {
      return jsonErr("Missing anonymous ID", 401);
    }

    const baseSelect = {
      id: true,
      title: true,
      createdAt: true,
      password: true, // derive locked
      visibility: true,
      shareCode: true,
    };

    const rows = scope === "public"
      ? await prisma.uploadedtext.findMany({
        where: {
          AND: [
            allCodes.size
              ? { OR: [{ visibility: "PUBLIC" }, { visibility: "CODED", shareCode: { in: Array.from(allCodes) } }] }
              : { visibility: "PUBLIC" },
            cursor ? { createdAt: { lt: new Date(cursor) } } : {},
          ],
        },
        orderBy: { createdAt: "desc" },
        take: limit + 1, // fetch one extra to know if there's a next page
        select: baseSelect,
      })
      : await prisma.uploadedtext.findMany({
        where: { anonId },
        orderBy: { createdAt: "desc" },
        select: {
          ...baseSelect,
          uploadview: {
            where: { anonId },
            orderBy: { viewedAt: "desc" },
            take: 1,
            select: { viewedAt: true },
          },
        },
      });

    const page = rows.slice(0, limit);
    const nextCursor =
      rows.length > limit ? rows[limit - 1].createdAt.toISOString() : null;

    const data = page.map((r) => ({
      id: r.id,
      title: r.title,
      createdAt: r.createdAt,
      locked: !!r.password,
      visibility: r.visibility,
      // Only include viewedAt for "mine"
      viewedAt: "uploadview" in r ? r.uploadview[0]?.viewedAt ?? null : undefined,
      // Expose code ONLY when this item actually matched a provided/saved code,
      // or when it's PUBLIC (we set null to avoid leaking codes broadly).
      shareCode:
        scope === "public"
          ? (r.visibility === "CODED" && allCodes.has((r.shareCode || "").toUpperCase())
            ? r.shareCode
            : null)
          : undefined,
    }));

    return jsonOk({ data, nextCursor });
  } catch (e) {
    console.error("uploadedtext GET failed:", e);
    return jsonErr("Server error", 500);
  }
}

export async function DELETE(req) {
  const anonId = await getAnonId();
  if (!anonId) return jsonErr("Unauthorized", 401);

  const Body = z.object({ id: z.coerce.number().int().positive() });
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonErr("Missing ID", 400, { issues: parsed.error.issues });
  const { id } = parsed.data;

  const text = await prisma.uploadedtext.findUnique({
    where: { id },
  });

  if (!text || text.anonId !== anonId) {
    return jsonErr("Not found or not authorized", 403);
  }

  await prisma.$transaction([
    prisma.uploadview.deleteMany({ where: { uploadId: id } }),
    prisma.uploadunlock.deleteMany({ where: { uploadId: id } }),
    prisma.uploadedtext.delete({ where: { id } }),
  ]);

  return jsonOk();
}
