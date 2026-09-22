import type { OrderStatus } from '../lib/types';

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'EN_ATTENTE', label: 'Commande reçue' },
  { status: 'CONFIRMEE', label: 'Confirmée' },
  { status: 'EN_PREPARATION', label: 'En préparation' },
  { status: 'EXPEDIEE', label: 'Expédiée' },
  { status: 'LIVREE', label: 'Livrée' },
];

function Check() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/** Frise d'avancement d'une commande : reçue → confirmée → préparation → expédiée → livrée. */
export function OrderTimeline({ status }: { status: OrderStatus }) {
  if (status === 'ANNULEE') {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-red-50 px-4 py-3 text-red-800">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-600 text-white">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </span>
        <span className="font-semibold">Commande annulée</span>
      </div>
    );
  }

  const currentIndex = STEPS.findIndex((s) => s.status === status);

  return (
    <ol>
      {STEPS.map((step, i) => {
        const done = i < currentIndex;
        const current = i === currentIndex;
        const last = i === STEPS.length - 1;
        return (
          <li key={step.status} className="flex gap-3.5">
            <div className="flex flex-col items-center">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                  done || current
                    ? `bg-brand-600 text-white ${current ? 'shadow-[0_0_0_5px_theme(colors.brand.100)]' : ''}`
                    : 'border-2 border-slate-300'
                }`}
              >
                {(done || current) && <Check />}
              </span>
              {!last && <span className={`h-6 w-0.5 ${done ? 'bg-brand-600' : 'bg-slate-200'}`} />}
            </div>
            <div className={last ? '' : 'pb-2'}>
              <span className={`block text-[15px] ${current ? 'font-bold text-slate-900' : done ? 'font-semibold text-slate-500' : 'font-semibold text-slate-400'}`}>
                {step.label}
              </span>
              {current && <span className="block text-[13px] text-slate-500">Étape actuelle</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
