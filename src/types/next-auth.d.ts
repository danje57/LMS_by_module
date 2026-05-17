import { RoleType } from "@prisma/client";
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      roles: RoleType[];
      sessionMode: "admin" | "user" | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    roles: RoleType[];
    sessionMode: "admin" | "user" | null;
  }
}
