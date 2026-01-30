import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from '@/components/SessionProvider';

// Fonts: use CSS variables from globals.css to avoid Turbopack next/font resolution bug

export const metadata: Metadata = {
  title: "Vibrant Wave Editor",
  description: "Canvas-based Image Generator",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const settings = JSON.parse(localStorage.getItem('app-settings') || '{}');
                const theme = settings.theme || 'system';
                const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                if (isDark) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="antialiased">
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
