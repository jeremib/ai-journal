import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { upsertUser } from "@/lib/db";

const allowed = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  pages: { signIn: "/" },
  callbacks: {
    signIn({ profile }) {
      if (!profile?.email || profile.email_verified === false) return false;
      if (allowed.length && !allowed.includes(profile.email.toLowerCase())) return false;
      return true;
    },
    jwt({ token, profile }) {
      // `profile` is only present on the initial sign-in.
      if (profile?.sub && profile.email) {
        token.uid = profile.sub;
        upsertUser({
          id: profile.sub,
          email: profile.email,
          name: profile.name ?? null,
          image: (profile.picture as string | undefined) ?? null,
        });
      }
      return token;
    },
    session({ session, token }) {
      if (token.uid) session.user.id = token.uid as string;
      return session;
    },
  },
});
