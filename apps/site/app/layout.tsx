import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { mono, sans } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "AisleRun: checkout testing your AI agent can order", template: "%s · AisleRun" },
  description: "Your agent pays for one real browser run through PayBox. AisleRun shops your product page on a phone and a desktop and returns the recording and the first step that broke.",
  referrer: "no-referrer",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: "#ffffff", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <a className="skip" href="#main">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
