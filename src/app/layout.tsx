import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { InstantNavigationLoader } from "@/components/InstantNavigationLoader";
import {
  DASHBOARD_APP_NAME,
  DEFAULT_DASHBOARD_DESCRIPTION,
  DEFAULT_DASHBOARD_PAGE_TITLE,
} from "@/lib/metadata";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: DEFAULT_DASHBOARD_PAGE_TITLE,
    template: `%s | ${DASHBOARD_APP_NAME}`,
  },
  description: DEFAULT_DASHBOARD_DESCRIPTION,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground overflow-x-hidden`}
      >
        <div className="flex min-w-0">
          <Sidebar />
          <main className="relative flex-1 mt-14 md:mt-0 md:ml-56 min-h-screen min-w-0 overflow-x-hidden">
            <InstantNavigationLoader />
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
