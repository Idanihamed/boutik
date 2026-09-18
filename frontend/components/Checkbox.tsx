'use client';

export function Checkbox({
  id,
  label,
  checked,
  onChange,
  disabled,
  hint,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm text-slate-700">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
        {label}
      </label>
      {hint && <p className="-mt-1 pl-8 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
