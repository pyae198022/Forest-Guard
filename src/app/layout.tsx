import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ForestGuard AI — Data Mining Dashboard",
  description:
    "Full-stack data mining application for forest ecosystem monitoring: dataset exploration, preprocessing, visualization, descriptive mining, AI deforestation-risk prediction and model evaluation.",
  keywords: ["ForestGuard", "data mining", "deforestation", "machine learning", "scikit-learn", "dashboard", "university project"],
  authors: [{ name: "ForestGuard AI Project" }],
  icons: {
    icon: "data:image/svg+xml," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path d="M24 3L41 9.5V22c0 10.5-7.2 19.4-17 23C14.2 41.4 7 32.5 7 22V9.5L24 3z" fill="%2310b981"/></svg>',
    ),
  },
  openGraph: {
    title: "ForestGuard AI",
    description: "Forest ecosystem intelligence — data mining dashboard",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
