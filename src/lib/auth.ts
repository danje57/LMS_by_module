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
          where: { email: credentials.email as string },
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
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (trigger === "update" && (session as { sessionMode?: unknown })?.sessionMode !== undefined) {
        token.sessionMode = (session as { sessionMode: "admin" | "user" | null }).sessionMode;
      }
      if (user) {
        token.id = user.id;
        token.roles = (user as { roles?: RoleType[] }).roles ?? [];
        token.sessionMode = "user";
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.roles = token.roles as RoleType[];
        session.user.sessionMode = (token.sessionMode as "admin" | "user" | null) ?? null;
      }
      return session;
    },
  },
});
