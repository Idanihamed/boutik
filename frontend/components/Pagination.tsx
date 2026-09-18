'use client';

import { Button } from './ui';

export function Pagination({
  meta,
  onChange,
}: {
  meta: { page: number; totalPages: number };
  onChange: (page: number) => void;
}) {
  if (meta.totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between text-sm text-slate-600">
      <Button variant="secondary" disabled={meta.page <= 1} onClick={() => onChange(meta.page - 1)}>
        Précédent
      </Button>
      <span>
        Page {meta.page} sur {meta.totalPages}
      </span>
      <Button variant="secondary" disabled={meta.page >= meta.totalPages} onClick={() => onChange(meta.page + 1)}>
        Suivant
      </Button>
    </div>
  );
}
