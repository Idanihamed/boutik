'use client';

import { useState } from 'react';
import type { ProductImage } from '../../lib/types';

export function ProductGallery({ images, name }: { images: ProductImage[]; name: string }) {
  const ordered = [...images].sort((a, b) => Number(b.isMain) - Number(a.isMain));
  const [index, setIndex] = useState(0);
  const current = ordered[index];

  if (!current) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-xl bg-slate-100 text-slate-400">
        Pas de photo
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={current.url} alt={current.alt ?? name} className="aspect-square w-full rounded-xl border border-slate-200 bg-white object-contain" />
      {ordered.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto">
          {ordered.map((img, i) => (
            <li key={img.url}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Voir la photo ${i + 1}`}
                aria-current={i === index}
                className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 ${i === index ? 'border-brand-600' : 'border-slate-200'}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
