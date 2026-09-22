'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Modal } from '../ui';

export interface NavItem {
  href: string;
  label: string;
}

/** Icônes de la barre du bas (traits fins, héritent la couleur du texte). */
const ICONS: Record<string, React.ReactNode> = {
  '/espace': <path d="m3 11 9-8 9 8M5 10v10h14V10" />,
  '/espace/commandes': (
    <>
      <path d="M21 8 12 3 3 8v8l9 5 9-5z" />
      <path d="m3 8 9 5 9-5M12 13v8" />
    </>
  ),
  '/espace/produits': (
    <>
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z" />
      <circle cx="7" cy="7" r="1.5" />
    </>
  ),
  '/espace/messages': <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
};

const MORE_ICON = (
  <>
    <circle cx="5" cy="12" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="19" cy="12" r="1.5" />
  </>
);

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

/**
 * Barre de navigation fixe en bas de l'écran (téléphone) : les 4 rubriques du quotidien et un bouton
 * « Plus » qui ouvre toutes les autres. Sur ordinateur, l'espace garde ses onglets en haut.
 */
export function MobileNav({
  main,
  more,
  badges,
}: {
  main: NavItem[];
  more: NavItem[];
  badges: Record<string, number>;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === '/espace' ? pathname === '/espace' : pathname.startsWith(href));
  const moreActive = more.some((item) => isActive(item.href));

  return (
    <>
      <nav aria-label="Navigation principale" className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white sm:hidden">
        <ul className="flex h-[68px]">
          {main.map((item) => {
            const active = isActive(item.href);
            const badge = badges[item.href] ?? 0;
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex h-full flex-col items-center justify-center gap-1 text-xs ${
                    active ? 'font-bold text-brand-600' : 'font-semibold text-slate-500'
                  }`}
                >
                  <Icon>{ICONS[item.href]}</Icon>
                  {item.label}
                  {badge > 0 && (
                    <span className="absolute left-1/2 top-2 ml-2.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent-600 px-1 text-[11px] font-bold text-white">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
          {more.length > 0 && (
            <li className="flex-1">
              <button
                type="button"
                onClick={() => setOpen(true)}
                aria-haspopup="dialog"
                className={`flex h-full w-full flex-col items-center justify-center gap-1 text-xs ${
                  moreActive ? 'font-bold text-brand-600' : 'font-semibold text-slate-500'
                }`}
              >
                <Icon>{MORE_ICON}</Icon>
                Plus
              </button>
            </li>
          )}
        </ul>
      </nav>

      <Modal open={open} title="Toutes les rubriques" onClose={() => setOpen(false)}>
        <ul className="-mx-1 grid grid-cols-2 gap-2">
          {more.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={isActive(item.href) ? 'page' : undefined}
                className={`flex min-h-[52px] items-center rounded-xl border px-3 text-[15px] font-semibold ${
                  isActive(item.href) ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-900'
                }`}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
