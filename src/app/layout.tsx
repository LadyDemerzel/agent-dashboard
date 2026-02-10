import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Agent Dashboard",
  description: "Coordination hub for the agent team",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-950 text-zinc-100 overflow-x-hidden`}
      >
        <div className="flex min-w-0">
          <Sidebar />
          <main className="flex-1 mt-16 md:mt-0 md:ml-56 min-h-screen min-w-0 overflow-x-hidden">{children}</main>
        </div>
      </body>
    </html>
  );
}
