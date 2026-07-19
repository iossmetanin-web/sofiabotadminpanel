'use client';

/* ────────────────────────────────────────────────────────────────
   Sofia admin building blocks
   Design language: dark charcoal + antique amber, hairline borders,
   mono numerals, motivated motion only.
   ──────────────────────────────────────────────────────────────── */

import * as React from 'react';
import { useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkline } from './Sparkline';
import type { LucideIcon } from 'lucide-react';

/* ── Section header ───────────────────────────────────────────
   No eyebrow. Headline + optional one-line secondary text,
   stacked vertically. */

export function SectionHeader({
  title,
  description,
  right,
  className,
}: {
  title: string;
  description?: string;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="space-y-1.5">
        <h2 className="text-2xl font-semibold tracking-tight leading-none text-zinc-100">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-zinc-400 leading-relaxed max-w-[60ch]">
            {description}
          </p>
        )}
      </div>
      {right && <div className="flex items-center gap-2 shrink-0">{right}</div>}
    </div>
  );
}

/* ── Bento tile ───────────────────────────────────────────────
   A single panel cell with hairline border, slight elevation,
   hover state.  Use inside an asymmetric grid. */

export function BentoTile({
  className,
  children,
  span,
  as: Tag = 'div',
  interactive = true,
}: {
  className?: string;
  children: React.ReactNode;
  span?: string;
  as?: React.ElementType;
  interactive?: boolean;
}) {
  return (
    <Tag
      className={cn(
        'relative rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5',
        'shadow-sm shadow-black/40',
        interactive && 'transition-all duration-300 hover:border-amber-500/30 hover:scale-[1.02] hover:shadow-md hover:shadow-amber-500/5',
        span,
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/* ── Metric tile ──────────────────────────────────────────────
   Big mono number, uppercase label below. Optional sparkline. */

export function MetricTile({
  label,
  value,
  sub,
  icon: Icon,
  loading,
  spark,
  sparkColor = '#fbbf24',
  accent = 'text-amber-400',
  className,
}: {
  label: string;
  value?: number;
  sub?: React.ReactNode;
  icon?: LucideIcon;
  loading?: boolean;
  spark?: number[];
  sparkColor?: string;
  accent?: string;
  className?: string;
}) {
  return (
    <BentoTile className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
          {label}
        </span>
        {Icon && <Icon className={cn('w-3.5 h-3.5', accent)} strokeWidth={1.5} />}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="text-3xl font-mono tabular-nums font-semibold text-zinc-100 leading-none">
          {loading ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <AnimatedNumber value={value ?? 0} />
          )}
        </div>
        {spark && spark.length > 1 && !loading && (
          <Sparkline data={spark} width={88} height={28} color={sparkColor} />
        )}
      </div>
      {sub && <div className="text-xs text-zinc-500 leading-relaxed">{sub}</div>}
    </BentoTile>
  );
}

/* ── AnimatedNumber ───────────────────────────────────────────
   Lightweight count-up using requestAnimationFrame.
   Renders a mono tabular-nums span so the final value
   keeps its column width even before animation starts. */

export function AnimatedNumber({
  value,
  className,
  duration = 700,
}: {
  value: number;
  className?: string;
  duration?: number;
}) {
  const spanRef = useRef(value);
  const [display, setDisplay] = React.useState(value);
  const reduce = useReducedMotion();

  React.useEffect(() => {
    if (reduce) {
      setDisplay(value);
      spanRef.current = value;
      return;
    }
    const startVal = spanRef.current;
    const endVal = value;
    spanRef.current = endVal;
    if (startVal === endVal) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.round(startVal + (endVal - startVal) * eased);
      setDisplay(current);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduce]);

  return (
    <span className={cn('font-mono tabular-nums', className)}>
      {display.toLocaleString('ru-RU')}
    </span>
  );
}

/* ── EmptyState ───────────────────────────────────────────────
   Composed: small amber icon + title + hint + optional action. */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-amber-500/5 mb-4 shadow-sm shadow-amber-500/10">
        <Icon className="w-5 h-5 text-amber-400" strokeWidth={1.5} />
      </div>
      <p className="text-sm font-medium text-zinc-200 mb-1.5">{title}</p>
      {description && (
        <p className="text-xs text-zinc-500 max-w-[44ch] leading-relaxed mb-4">
          {description}
        </p>
      )}
      {action && onAction && (
        <button
          onClick={onAction}
          className="text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors active:translate-y-px mt-1 inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/40"
        >
          {action} <span className="text-amber-500/70">→</span>
        </button>
      )}
    </div>
  );
}

/* ── ErrorState ───────────────────────────────────────────────
   Inline rose-400 text + retry button. */

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-sm">
      <span className="text-rose-400">{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs font-medium text-amber-400 hover:text-amber-300 active:translate-y-px transition"
        >
          Повторить →
        </button>
      )}
    </div>
  );
}

/* ── Stagger reveal wrapper ───────────────────────────────────
   Honors reduced-motion; otherwise fades + lifts each child. */

export function StaggerGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.05 } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 8 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

/* ── Tab content transition ─────────────────────────────────── */

export function TabTransition({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ── Hairline divider with optional centered label ─────────── */

export function Hairline({
  label,
  className,
}: {
  label?: React.ReactNode;
  className?: string;
}) {
  if (!label) return <div className={cn('h-px bg-zinc-800/70', className)} />;
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="h-px flex-1 bg-zinc-800/70" />
      <span className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </span>
      <div className="h-px flex-1 bg-zinc-800/70" />
    </div>
  );
}

/* ── Mini bar row (used in distributions, breakdowns) ──────── */

export function MiniBar({
  label,
  value,
  display,
  max,
  color = 'bg-amber-500/70',
  muted = false,
}: {
  label: React.ReactNode;
  value: number;
  display: React.ReactNode;
  max: number;
  color?: string;
  muted?: boolean;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className={cn('truncate', muted ? 'text-zinc-500' : 'text-zinc-300')}>
          {label}
        </span>
        <span className="font-mono tabular-nums text-zinc-400">{display}</span>
      </div>
      <div className="h-1.5 rounded-full bg-zinc-800/70 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
