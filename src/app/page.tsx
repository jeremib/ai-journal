import Image from "next/image";
import { auth, signIn, signOut } from "@/auth";
import { listProjects } from "@/lib/db";
import ProjectList from "@/components/ProjectList";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <Image src="/icons/icon-192.png" alt="" width={80} height={80} className="rounded-2xl shadow" priority />
        <h1 className="mt-6 text-3xl font-bold tracking-tight">AI Journal</h1>
        <p className="mt-3 max-w-sm text-stone-600 dark:text-stone-400">
          Capture your projects with writing, voice notes, video and links. Then ask AI anything about what you&apos;ve recorded.
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
          className="mt-8"
        >
          <button className="flex items-center gap-3 rounded-full bg-white px-6 py-3 font-medium text-stone-800 shadow ring-1 ring-stone-300 transition hover:bg-stone-50 active:scale-95">
            <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
              <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
            </svg>
            Continue with Google
          </button>
        </form>
      </main>
    );
  }

  const projects = listProjects(session.user.id);

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <header className="mb-6 flex items-center gap-3">
        <h1 className="flex-1 text-2xl font-bold tracking-tight">Projects</h1>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm text-stone-600 hover:bg-stone-200 dark:text-stone-300 dark:hover:bg-stone-800" title="Sign out">
            {session.user.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={session.user.image} alt="" className="h-7 w-7 rounded-full" referrerPolicy="no-referrer" />
            )}
            Sign out
          </button>
        </form>
      </header>
      <ProjectList projects={projects} />
    </main>
  );
}
