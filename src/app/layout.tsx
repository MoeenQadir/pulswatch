import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "PulseWatch — Uptime & Status Monitoring",
    template: "%s · PulseWatch",
  },
  description:
    "Monitor websites, APIs and infrastructure. Uptime history, incidents, public status pages and webhooks — built with Next.js, Prisma and Redis.",
  keywords: ["uptime monitoring", "status page", "incident management", "devops"],
  openGraph: {
    title: "PulseWatch — Uptime & Status Monitoring",
    description: "Know before your users do. Uptime monitoring with incidents, status pages and webhooks.",
    type: "website",
    url: "/",
    siteName: "PulseWatch",
  },
  twitter: {
    card: "summary_large_image",
    title: "PulseWatch — Uptime & Status Monitoring",
    description: "Know before your users do.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
