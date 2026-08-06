import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from 'sonner';
import Header from '@/components/Header';
import AuthGuard from '@/components/AuthGuard';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mymifa",
  description: "Tracker de candidatures pour suivre, piloter et préparer vos entretiens.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthGuard>
          <Header />
          <div className="flex-1">{children}</div>
        </AuthGuard>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
