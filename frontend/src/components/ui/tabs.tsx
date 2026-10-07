import { cn } from '@/lib/utils';

export function Tabs<T extends string>({
  value,
  onChange,
  items,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: string; count?: number }[];
  className?: string;
}) {
  return (
    <div className={cn('-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0', className)}>
      <div role="tablist" className="inline-flex gap-1 rounded-lg bg-slate-100 p-1">
        {items.map((item) => (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={value === item.value}
            onClick={() => onChange(item.value)}
            className={cn(
              'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer',
              value === item.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span className={cn('rounded-full px-1.5 text-xs', value === item.value ? 'bg-primary-soft text-primary' : 'bg-slate-200 text-slate-600')}>
                {item.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
