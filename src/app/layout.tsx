import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "SevaSetu AI — Smart Resource Allocation for NGOs",
  description:
    "AI-powered platform that turns scattered NGO field reports into clear local need signals and intelligently matches volunteers to the right tasks and locations.",
  keywords: [
    "NGO",
    "health camp",
    "resource allocation",
    "AI",
    "community health",
    "Google Solution Challenge",
  ],
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
