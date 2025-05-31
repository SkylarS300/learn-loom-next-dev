import { cookies } from "next/headers";
import { v4 as uuidv4 } from "uuid";

export async function getOrSetAnonId() {
  const cookieStore = await cookies();
  let anonId = cookieStore.get("learnloomId")?.value;

  if (!anonId) {
    anonId = uuidv4();
    cookieStore.set("learnloomId", anonId, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 90, // 90 days
    });
  }

  return anonId;
}
