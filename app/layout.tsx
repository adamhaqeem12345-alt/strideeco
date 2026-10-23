import type { Metadata } from "next";
import { ClerkProvider } from '@clerk/nextjs';
import { ui } from '@clerk/ui';
import { authConfigured } from '../lib/auth-config';
import "./globals.css";

export const metadata: Metadata = {
  title: "StrideEco — A little movement, a better day",
  description: "Plan a walk through Elmina, explore shade scenarios and try a drinking-water reward.",
  icons: {
    icon: [
      { url: '/favicon.png?v=se-wordmark-20261023', type: 'image/png', sizes: '32x32' },
      { url: '/strideeco-monogram.png?v=se-wordmark-20261023', type: 'image/png', sizes: '512x512' },
    ],
    shortcut: '/favicon.ico?v=se-wordmark-20261023',
    apple: [{ url: '/apple-touch-icon.png?v=se-wordmark-20261023', type: 'image/png', sizes: '180x180' }],
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
            colorPrimary: '#087c80', colorPrimaryForeground: '#ffffff',
            colorForeground: '#0c343c', colorMutedForeground: '#456a70',
            colorBackground: '#ffffff', colorMuted: '#eafffc',
            colorInput: '#ffffff', colorInputForeground: '#0c343c',
            colorBorder: '#9adfdc', colorNeutral: '#0c343c', colorRing: '#055a61',
            fontFamily: '"Trebuchet MS", "Segoe UI", Arial, sans-serif',
          },
          elements: {
            formButtonPrimary: { '&:hover:not(:disabled)': { backgroundColor: '#055a61' } },
            formFieldInput: { '&[data-variant="default"]': { border: '1px solid #9adfdc' } },
          },
        }}
      >{children}</ClerkProvider> : children}</body>
    </html>
  );
}
