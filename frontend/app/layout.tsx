import type { Metadata } from 'next';
import './globals.css';
import { SessionProvider } from '../lib/session';
import { Header } from '../components/Header';

export const metadata: Metadata = {
  title: 'Boutik',
  description: 'Créez votre boutique en ligne et vendez à vos clients.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <SessionProvider>
          <Header />
          <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">{children}</main>
        </SessionProvider>
      </body>
    </html>
  );
}
