import type { Metadata } from "next";
import { ClerkProvider } from '@clerk/nextjs';
import { shadcn } from '@clerk/ui/themes';
import { authConfigured } from '../lib/auth-config';
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
      <body className="antialiased">{authConfigured() ? <ClerkProvider
        publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
        signInUrl="/sign-in" signUpUrl="/sign-up"
        signInFallbackRedirectUrl="/" signUpFallbackRedirectUrl="/"
        afterSignOutUrl="/"
        appearance={{ theme: shadcn }}
      >{children}</ClerkProvider> : children}</body>
    </html>
  );
}
