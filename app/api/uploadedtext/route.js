import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

// Short, URL-safe share code (e.g., 6 chars)
function genShareCode(len = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}


export async function POST(req) {
  const cookieStore = await cookies();
  const anonId = cookieStore.get("learnloomId")?.value;
  if (!anonId) return new Response("Unauthorized", { status: 401 });

  const { title, content, password, visibility = "PRIVATE" } = await req.json();
  if (!title || !content) {
    return new Response("Missing title or content", { status: 400 });
  }

  const hashed = password ? await bcrypt.hash(password, 10) : null;
  const vis = ["PRIVATE", "CODED", "PUBLIC"].includes(String(visibility).toUpperCase())
    ? String(visibility).toUpperCase()
    : "PRIVATE";
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
  return Response.json({ id: newText.id, shareCode: newText.shareCode, visibility: newText.visibility });
}

// Unified GET (supports your uploads; or community via ?scope=public[&code=XXXX] plus saved cookie codes)
export async function GET(req) {
  const cookieStore = await cookies(); // Next 15: await cookies()
  const { searchParams } = new URL(req.url);
  const scope = (searchParams.get("scope") || "mine").toLowerCase(); // mine | public  const codeParamRaw = searchParams.get("code")?.trim() || null;
  const codeParamRaw = searchParams.get("code")?.trim() || null;
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 24)));
  const cursor = searchParams.get("cursor"); // ISO date string
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
      return Response.json({ ok: false, error: "Missing anonymous ID" }, { status: 401 });
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

    return Response.json({ ok: true, data, nextCursor });
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
