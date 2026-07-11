import { cn } from "../lib/util";

export interface SegmentedOption<T> {
  value: T;
  label: string;
}

/**
 * A segmented single-choice control (difficulty / count / timer on the create screen).
 * Implemented as a radiogroup so it is keyboard- and screen-reader-navigable.
 */
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  name,
}: {
  label: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  name: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1.5">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={active}
            name={name}
            onClick={() => onChange(opt.value)}
            className={cn(
              "min-h-[44px] flex-1 rounded-xl border-[1.5px] px-1 py-2 text-sm font-extrabold transition-colors",
              active
                ? "border-primary bg-primary text-on-primary"
                : "border-line bg-muted text-sub hover:text-ink",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
