import type { Metadata } from "next";
import { ClerkProvider } from '@clerk/nextjs';
import { ui } from '@clerk/ui';
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
      <body className="antialiased">{authConfigured() ? <ClerkProvider ui={ui}
        publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
        signInUrl="/sign-in" signUpUrl="/sign-up"
        signInFallbackRedirectUrl="/" signUpFallbackRedirectUrl="/"
        afterSignOutUrl="/"
        appearance={{
          cssLayerName: 'clerk',
          variables: {
            colorPrimary: '#23634d', colorPrimaryForeground: '#ffffff',
            colorForeground: '#253b32', colorMutedForeground: '#7d867e',
            colorBackground: '#ffffff', colorMuted: '#f8f9f5',
            colorInput: '#ffffff', colorInputForeground: '#253b32',
            colorBorder: '#e7e9e1', colorNeutral: '#253b32', colorRing: '#23634d',
            fontFamily: '"Segoe UI", Arial, sans-serif',
          },
          elements: {
            formFieldInput: { '&[data-variant="default"]': { border: '1px solid #e7e9e1' } },
          },
        }}
      >{children}</ClerkProvider> : children}</body>
    </html>
  );
}
