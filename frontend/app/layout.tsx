import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense, type CSSProperties } from "react";
import { ToastProvider } from "@/components/ui/Feedback";
import Loading from "./loading";
import AppShell from "@/components/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "DramaCoo",
  description: "AI视频生成工具",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const preferences = await cookies();
  const initialOpen = preferences.get("dramacoo-sidebar-open")?.value !== "false";
  return (
    <html lang="zh-CN">
      <body
        className="antialiased"
      >
        <Suspense fallback={<div className="xyq-shell" style={{ "--app-sidebar-width": initialOpen ? "240px" : "64px" } as CSSProperties}><main className="xyq-main"><Loading /></main></div>}>
          <ToastProvider><AppShell initialOpen={initialOpen}>{children}</AppShell></ToastProvider>
        </Suspense>
      </body>
    </html>
  );
}
