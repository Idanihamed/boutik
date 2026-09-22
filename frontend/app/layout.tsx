import type { Metadata } from 'next';
import { Bricolage_Grotesque, Figtree } from 'next/font/google';
import './globals.css';
import { SessionProvider } from '../lib/session';
import { Header } from '../components/Header';

// Polices de l'identité Boutik : Figtree pour le texte, Bricolage Grotesque pour les titres.
const bodyFont = Figtree({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
const displayFont = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap' });

export const metadata: Metadata = {
  title: 'Boutik',
  description: 'Créez votre boutique en ligne et vendez à vos clients.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${bodyFont.variable} ${displayFont.variable} font-sans`}>
        <SessionProvider>
          <Header />
          <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">{children}</main>
        </SessionProvider>
      </body>
    </html>
  );
}
