import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/auth-context";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  title: "FamilyHub.care - Organize. Communicate. Support.",
  description: "A private, shared coordination tool for families caring for aging loved ones. Simple tools for families navigating care together.",
  keywords: "family care, elderly care, caregiver support, family coordination, healthcare management, family communication, aging parents, care coordination",
  authors: [{ name: "FamilyHub Team" }],
  robots: "index, follow",
  openGraph: {
    title: "FamilyHub.care - When caring feels overwhelming, we help you breathe",
    description: "Simple tools for families navigating care together. Coordinate appointments, share responsibilities, and keep important information secure.",
    url: "https://familyhub.care",
    siteName: "FamilyHub.care",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "FamilyHub.care - Family Care Coordination Made Simple",
    description: "Simple tools for families navigating care together. Private, secure, and built by caregivers for caregivers.",
  },
  icons: {
    icon: '/logo.svg',
    shortcut: '/logo.svg',
    apple: '/logo.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="familyhub">
      <body className={inter.className}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}