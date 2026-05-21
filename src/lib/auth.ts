import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { RoleType } from "@prisma/client";

export const { handlers, signIn, signOut, auth, unstable_update: updateSession } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  // Accepte n'importe quel host : localhost, IP locale, domaine HTTPS
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: (credentials.email as string).trim().toLowerCase() },
          include: {
            roles: { include: { role: true } },
          },
        });

        if (!user || !user.passwordHash || !user.isActive) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!valid) return null;

        const roles = user.roles.map((ur) => ur.role.name);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          roles,
          locale: user.locale as "fr" | "en",
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (trigger === "update") {
        const s = session as { sessionMode?: unknown; locale?: unknown };
        if (s?.sessionMode !== undefined) token.sessionMode = s.sessionMode as "admin" | "user" | null;
        if (s?.locale !== undefined) token.locale = s.locale as "fr" | "en";
      }
      if (user) {
        token.id = user.id;
        token.roles = (user as { roles?: RoleType[] }).roles ?? [];
        token.sessionMode = "user";
        token.locale = (user as { locale?: "fr" | "en" }).locale ?? "fr";
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.roles = token.roles as RoleType[];
        session.user.sessionMode = (token.sessionMode as "admin" | "user" | null) ?? null;
        session.user.locale = (token.locale as "fr" | "en") ?? "fr";
      }
      return session;
    },
  },
});
