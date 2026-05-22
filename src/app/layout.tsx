import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { auth } from "@/lib/auth";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LMS",
  description: "Learning Management System",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const theme = session?.user?.theme ?? "system";
  const isDark = theme === "dark";

  return (
    <html lang="fr" className={`${inter.variable}${isDark ? " dark" : ""}`}>
      <head>
        {theme === "system" && (
          <script
            dangerouslySetInnerHTML={{
              __html: `if(window.matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.classList.add('dark')`,
            }}
          />
        )}
      </head>
      <body className="font-sans">
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      </body>
    </html>
  );
}
