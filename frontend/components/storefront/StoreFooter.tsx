import Link from 'next/link';
import type { Storefront } from '../../lib/types';

type SocialKey = Exclude<keyof NonNullable<Storefront['settings']>, 'shippingFee' | 'freeShippingThreshold'>;

const SOCIALS: { key: SocialKey; label: string }[] = [
  { key: 'facebookUrl', label: 'Facebook' },
  { key: 'instagramUrl', label: 'Instagram' },
  { key: 'tiktokUrl', label: 'TikTok' },
  { key: 'youtubeUrl', label: 'YouTube' },
  { key: 'linkedinUrl', label: 'LinkedIn' },
  { key: 'xUrl', label: 'X' },
];

/** Uniquement des liens http(s) : une adresse « javascript: » saisie par une entreprise ne doit jamais devenir cliquable. */
function safeUrl(url: string | null | undefined): string | null {
  return url && /^https?:\/\//i.test(url) ? url : null;
}

export function whatsappUrl(number: string | null | undefined, text?: string): string | null {
  const digits = (number ?? '').replace(/\D/g, '');
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export function StoreFooter({ store }: { store: Storefront }) {
  const whatsapp = whatsappUrl(store.settings?.whatsappNumber);
  const socials = SOCIALS.map((s) => ({ label: s.label, url: safeUrl(store.settings?.[s.key]) })).filter((s) => s.url);

  return (
    <footer className="mt-12 space-y-4 border-t border-slate-200 pt-6 text-sm text-slate-600">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {whatsapp && (
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="font-medium text-emerald-700 hover:underline">
            WhatsApp
          </a>
        )}
        {socials.map((s) => (
          <a key={s.label} href={s.url!} target="_blank" rel="noopener noreferrer" className="hover:underline">
            {s.label}
          </a>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>
          © {new Date().getFullYear()} {store.name} · Propulsé par <Link href="/" className="font-medium hover:underline">Boutik</Link>
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link href="/mentions-legales" className="hover:underline">
            Mentions légales
          </Link>
          <Link href="/conditions" className="hover:underline">
            Conditions
          </Link>
          <Link href="/confidentialite" className="hover:underline">
            Confidentialité
          </Link>
          <Link href={`/${store.slug}/signaler`} className="hover:underline">
            Signaler cette entreprise
          </Link>
        </span>
      </div>
    </footer>
  );
}
