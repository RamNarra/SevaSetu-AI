import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from 'react-hot-toast';
import OfflineSync from '@/components/layout/OfflineSync';

export const metadata: Metadata = {
  title: 'SevaSetu AI — Smart Resource Allocation for NGOs',
  applicationName: 'SevaSetu AI',
  description:
    'AI-powered platform that turns scattered NGO field reports into clear local need signals and intelligently matches volunteers to the right tasks and locations.',
  keywords: [
    'NGO',
    'health camp',
    'resource allocation',
    'AI',
    'community health',
    'Google Solution Challenge',
  ],
  manifest: '/manifest.json',
  formatDetection: {
    telephone: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'SevaSetu AI',
  },
  icons: {
    icon: [
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#D4622B',
  colorScheme: 'light',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>
          {children}
          <OfflineSync />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                borderRadius: '12px',
                background: '#1A1A1A',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 500,
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
