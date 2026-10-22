import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StrideEco — A little movement, a better day",
  description: "Plan a walk through Elmina, explore shade scenarios and try a drinking-water reward.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
