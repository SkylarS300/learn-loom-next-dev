// lib/cookie.ts
import { cookies } from "next/headers";

export async function getAnonId(): Promise<string | null> {
  const cs = await cookies();
  return cs.get("learnloomId")?.value ?? null;
}

export async function setAnonIdCookie(anonId: string, maxAgeSec = 60 * 60 * 24 * 365 * 5) {
  const cs = await cookies();
  cs.set("learnloomId", anonId, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",   // <- lowercase
    maxAge: maxAgeSec,
  });
}

export async function clearAnonIdCookie() {
  const cs = await cookies();
  cs.set("learnloomId", "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",   // <- lowercase
  });
}
