import Image from "next/image";
import { auth, signIn } from "@/auth";
import { listProjects } from "@/lib/db";
import ShareTarget from "@/components/ShareTarget";

export const dynamic = "force-dynamic";

/**
 * Web Share Target landing page. Chromium PWAs post the share sheet payload
 * here as GET params; iOS has no share-target support, so the same params can
 * be opened directly (e.g. from an iOS Shortcut).
 */

const URL_RE = /https?:\/\/[^\s<>"')]+/i;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Shares put the link in `url`, or inline in `text` alongside a comment. */
function splitShare(url: string, text: string) {
  const direct = url.trim();
  if (direct) return { link: direct, note: text.trim() };
  const match = text.match(URL_RE);
  if (match) return { link: match[0], note: text.replace(match[0], " ").replace(/\s+/g, " ").trim() };
  return { link: "", note: text.trim() };
}

export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const title = first(params.title);
  const { link, note } = splitShare(first(params.url), first(params.text));
  const session = await auth();

  if (!session?.user?.id) {
    // Keep the payload across sign-in so the share is not lost.
    const back = new URLSearchParams();
    if (title) back.set("title", title);
    if (link) back.set("url", link);
    if (note) back.set("text", note);
    const redirectTo = `/share${back.size ? `?${back}` : ""}`;
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <Image src="/icons/icon-192.png" alt="" width={64} height={64} className="rounded-2xl shadow" priority />
        <h1 className="mt-5 text-2xl font-bold tracking-tight">Save this link</h1>
        <p className="mt-2 max-w-sm text-sm text-stone-600 dark:text-stone-400">
          Sign in and we&apos;ll add it to one of your projects.
        </p>
        {link && <p className="mt-3 max-w-sm truncate text-xs text-stone-500">{link}</p>}
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo });
          }}
          className="mt-6"
        >
          <button className="btn-primary px-6">Continue with Google</button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <ShareTarget projects={listProjects(session.user.id)} url={link} title={title} note={note} />
    </main>
  );
}
