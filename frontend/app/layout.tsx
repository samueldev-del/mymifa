import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from 'sonner';
import Header from '@/components/Header';
import AuthGuard from '@/components/AuthGuard';
import PwaProvider from '@/components/PwaProvider';
import { LangueProvider } from '@/i18n';

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
  description:
    "Bewerbungen verfolgen, Vorstellungsgespräche vorbereiten und Qualifikationslücken schließen.",
  applicationName: 'Mymifa',
  appleWebApp: {
    capable: true,
    title: 'Mymifa',
    statusBarStyle: 'default',
  },
  icons: {
    icon: '/icon-192.png',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#B8432C',
  // L'app est installée : la zone sous l'encoche doit être peinte par la page.
  viewportFit: 'cover',
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // lang est réécrit côté client par LangueProvider selon la langue choisie.
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LangueProvider>
          <AuthGuard>
            <Header />
            <div className="flex-1">{children}</div>
            <PwaProvider />
          </AuthGuard>
          <Toaster richColors position="top-right" />
        </LangueProvider>
      </body>
    </html>
  );
}
