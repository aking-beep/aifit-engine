import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import { Providers } from "@/components/providers";
import { THEME_BOOT_SCRIPT } from "@/design";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://aifit-engine.vercel.app";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAF9" },
    { media: "(prefers-color-scheme: dark)", color: "#08090C" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Fit — find the AI that fits you",
  description:
    "A five-minute quiz for anyone who uses AI: homework, a shop, a side hustle, or a team. Get a friendly profile and setup files for ChatGPT, Claude, Gemini, Cursor, and more.",
  applicationName: "Fit",
  appleWebApp: { title: "Fit", capable: true, statusBarStyle: "default" },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Fit — find the AI that fits you",
    description: "Five minutes. Get an AI setup you can paste into ChatGPT, Claude, Gemini, or Cursor.",
    url: "/",
    siteName: "Fit",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Fit — five minutes to an AI setup that matches how you work" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Fit — find the AI that fits you",
    description: "Five minutes. Get an AI setup you can paste into the apps you already use.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-lg"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
