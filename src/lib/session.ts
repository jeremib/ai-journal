import { auth } from "@/auth";
import { NextResponse } from "next/server";

/** Returns the signed-in user's id, or null. */
export async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });
export const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });
export const badRequest = (error: string) => NextResponse.json({ error }, { status: 400 });
