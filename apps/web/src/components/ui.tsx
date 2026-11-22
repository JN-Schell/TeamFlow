import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, ChevronDown, Loader2, X } from "lucide-react";
import { cn, humanize, initials, PRIORITY_DOT, PRIORITY_STYLES, STATUS_STYLES } from "../lib/utils";

// ─── Buttons ─────────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type ButtonSize = "sm" | "md" | "icon" | "icon-sm";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-indigo-600 text-white shadow-sm hover:bg-indigo-500 focus-visible:ring-indigo-500/40 disabled:bg-indigo-400",
  secondary:
    "bg-slate-100 text-slate-700 hover:bg-slate-200 focus-visible:ring-slate-400/40 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700",
  ghost:
    "text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-400/40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100",
  danger:
    "bg-red-600 text-white shadow-sm hover:bg-red-500 focus-visible:ring-red-500/40 disabled:bg-red-400",
  outline:
    "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-400/40 dark:border-slate-700 dark:bg-transparent dark:text-slate-200 dark:hover:bg-slate-800/60",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-xs",
  md: "h-9 gap-2 px-4 text-sm",
  icon: "h-9 w-9",
  "icon-sm": "h-7 w-7",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, icon, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg font-medium outline-none transition focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-70",
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

// ─── Form controls ───────────────────────────────────────────────────────────

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn("field-input", className)} {...props} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn("field-input min-h-[88px] resize-y", className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn("field-input appearance-none pr-8", className)} {...props}>
        {children}
      </select>
    );
  },
);

export function Field({
  label,
  hint,
  error,
  children,
  className,
  required,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
  required?: boolean;
}) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
        {required ? <span className="text-red-500">*</span> : null}
      </span>
      {children}
      {error ? (
        <span role="alert" className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
          <AlertTriangle className="h-3 w-3" /> {error}
        </span>
      ) : hint ? (
        <span className="block text-xs text-slate-400 dark:text-slate-500">{hint}</span>
      ) : null}
    </label>
  );
}

// ─── Display primitives ──────────────────────────────────────────────────────

type BadgeTone = "neutral" | "indigo" | "green" | "amber" | "red" | "sky" | "pink";

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  red: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  pink: "bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
        STATUS_STYLES[status] ?? STATUS_STYLES.PLANNING,
      )}
    >
      {humanize(status)}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        PRIORITY_STYLES[priority],
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", PRIORITY_DOT[priority])} />
      {humanize(priority)}
    </span>
  );
}

function relativeLuminance(red: number, green: number, blue: number) {
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

function contrastRatio(first: [number, number, number], second: [number, number, number]) {
  const firstLuminance = relativeLuminance(...first);
  const secondLuminance = relativeLuminance(...second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

export function accessibleColorPair(background: string) {
  const hex = background.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) {
    return { backgroundColor: background, color: "#ffffff" };
  }

  const rgb: [number, number, number] = [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
  const white: [number, number, number] = [255, 255, 255];
  const slate: [number, number, number] = [15, 23, 42];
  if (contrastRatio(rgb, white) >= 4.5) {
    return { backgroundColor: background, color: "#ffffff" };
  }
  if (contrastRatio(rgb, slate) >= 4.5) {
    return { backgroundColor: background, color: "#0f172a" };
  }

  for (let step = 1; step <= 12; step += 1) {
    const factor = 1 - step * 0.06;
    const adjusted: [number, number, number] = [
      Math.round(rgb[0] * factor),
      Math.round(rgb[1] * factor),
      Math.round(rgb[2] * factor),
    ];
    if (contrastRatio(adjusted, white) >= 4.5) {
      return {
        backgroundColor: `rgb(${adjusted[0]} ${adjusted[1]} ${adjusted[2]})`,
        color: "#ffffff",
      };
    }
  }
  return { backgroundColor: "#0f172a", color: "#ffffff" };
}

export function Avatar({
  name,
  color,
  size = "md",
  className,
}: {
  name: string;
  color: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    xs: "h-5 w-5 text-[9px]",
    sm: "h-6 w-6 text-[10px]",
    md: "h-8 w-8 text-[11px]",
    lg: "h-11 w-11 text-sm",
  };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold ring-2 ring-white dark:ring-ink-900",
        sizes[size],
        className,
      )}
      style={accessibleColorPair(color)}
      title={name}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({
  users,
  max = 3,
  size = "sm",
}: {
  users: { name: string; avatarColor: string }[];
  max?: number;
  size?: "xs" | "sm" | "md";
}) {
  const shown = users.slice(0, max);
  return (
    <div className="flex items-center">
      <div className="flex -space-x-1.5">
        {shown.map((user) => (
          <Avatar key={`${user.name}-${user.avatarColor}`} name={user.name} color={user.avatarColor} size={size} />
        ))}
      </div>
      {users.length > max ? (
        <span className="ml-1.5 text-[11px] font-medium text-slate-400">+{users.length - max}</span>
      ) : null}
    </div>
  );
}

export function ProgressBar({
  value,
  color,
  className,
  size = "md",
}: {
  value: number;
  color?: string;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800",
        size === "sm" ? "h-1.5" : "h-2",
        className,
      )}
    >
      <div
        className="h-full rounded-full bg-indigo-500 transition-all duration-500"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: color }}
      />
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin text-indigo-500", className)} />;
}

export function PageLoader({ label = "Loading workspace" }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-sm text-slate-400">
      <Spinner className="h-6 w-6" />
      {label}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-900 sm:text-[28px] dark:text-white">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  trend,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  trend?: ReactNode;
}) {
  return (
    <div className="surface p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {label}
        </p>
        {icon ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-500 dark:bg-indigo-500/10 dark:text-indigo-300">
            {icon}
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex items-end gap-2">
        <span className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">{value}</span>
        {trend}
      </div>
      {hint ? <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center dark:border-slate-700",
        className,
      )}
    >
      {icon ? (
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
          {icon}
        </div>
      ) : null}
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500 dark:text-slate-400">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

// ─── Overlays ────────────────────────────────────────────────────────────────

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function useOverlayFocus(open: boolean, onClose: () => void, returnFocusKey?: string) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const returnFocusKeyRef = useRef(returnFocusKey);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
    returnFocusKeyRef.current = returnFocusKey;
  }, [onClose, returnFocusKey]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const keyedPrevious = returnFocusKey
      ? document.querySelector<HTMLElement>(`[data-focus-return="${CSS.escape(returnFocusKey)}"]`)
      : null;
    if (keyedPrevious && !panel.contains(keyedPrevious)) previousFocusRef.current = keyedPrevious;
    else if (activeElement && !panel.contains(activeElement)) previousFocusRef.current = activeElement;
    const focusTarget =
      panel.querySelector<HTMLElement>("[autofocus],[data-autofocus]") ??
      panel.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ??
      panel;
    focusTarget.focus({ preventScroll: true });

    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) => !element.hasAttribute("hidden") && element.getAttribute("aria-hidden") !== "true",
      );
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      queueMicrotask(() => {
        if (document.contains(panel)) return;
        const explicitReturnKey = returnFocusKeyRef.current;
        let previous = explicitReturnKey
          ? document.querySelector<HTMLElement>(`[data-focus-return="${CSS.escape(explicitReturnKey)}"]`)
          : previousFocusRef.current;
        const returnKey = previous?.dataset.focusReturn;
        if (previous && !document.contains(previous) && returnKey) {
          previous = document.querySelector<HTMLElement>(`[data-focus-return="${CSS.escape(returnKey)}"]`);
        }
        if (previous && document.contains(previous)) previous.focus({ preventScroll: true });
        previousFocusRef.current = null;
      });
    };
  }, [open]);

  return panelRef;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const panelRef = useOverlayFocus(open, onClose);
  const titleId = useId();

  if (!open) return null;

  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 animate-fade-in bg-slate-950/60" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "relative max-h-[92vh] w-full animate-scale-in overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-float outline-none sm:rounded-2xl dark:border-slate-800 dark:bg-ink-900",
          widths[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[calc(92vh-9rem)] overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/60 px-5 py-3 dark:border-slate-800 dark:bg-ink-850/40">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  headerExtra,
  width = "max-w-xl",
  returnFocusKey,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  headerExtra?: ReactNode;
  width?: string;
  returnFocusKey?: string;
}) {
  const panelRef = useOverlayFocus(open, onClose, returnFocusKey);
  const titleId = useId();

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex justify-end">
      <div className="absolute inset-0 animate-fade-in bg-slate-950/50" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "relative flex h-full w-full animate-slide-in flex-col border-l border-slate-200 bg-white shadow-float outline-none dark:border-slate-800 dark:bg-ink-900",
          width,
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <div id={titleId} className="min-w-0 flex-1">{title}</div>
          <div className="flex items-center gap-1">
            {headerExtra}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="Close panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Navigation ──────────────────────────────────────────────────────────────

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  const tablistId = useId();

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();

    const current = tabs.findIndex((tab) => tab.value === value);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : event.key === "ArrowRight"
            ? (current + 1) % tabs.length
            : (current - 1 + tabs.length) % tabs.length;
    const nextValue = tabs[next]?.value;
    if (!nextValue) return;
    onChange(nextValue);
    requestAnimationFrame(() => {
      document.getElementById(`${tablistId}-${nextValue}`)?.focus();
    });
  }

  return (
    <div
      role="tablist"
      aria-label="Sections"
      onKeyDown={onKeyDown}
      className={cn("flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800", className)}
    >
      {tabs.map((tab) => (
        <button
          key={tab.value}
          id={`${tablistId}-${tab.value}`}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          tabIndex={value === tab.value ? 0 : -1}
          onClick={() => onChange(tab.value)}
          className={cn(
            "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition",
            value === tab.value
              ? "border-indigo-500 text-indigo-600 dark:border-indigo-400 dark:text-indigo-300"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200",
          )}
        >
          {tab.label}
          {tab.count !== undefined ? (
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {tab.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function Dropdown({
  trigger,
  children,
  align = "right",
  className,
  panelClassName,
  label,
}: {
  trigger: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
  panelClassName?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function menuItems() {
    return Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
  }

  function focusItem(index: number) {
    const items = menuItems();
    if (items.length === 0) return;
    items[Math.max(0, Math.min(items.length - 1, index))]?.focus();
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
      requestAnimationFrame(() => focusItem(0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      requestAnimationFrame(() => focusItem(menuItems().length - 1));
    }
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = menuItems();
    const current = items.findIndex((item) => item === document.activeElement);
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      focusItem(items.length === 0 ? 0 : (current + 1) % items.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusItem(current <= 0 ? items.length - 1 : current - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusItem(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusItem(items.length - 1);
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onTriggerKeyDown}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className="w-full text-left"
      >
        {label ? <span className="sr-only">{label}</span> : null}
        {trigger}
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className={cn(
            "absolute z-50 mt-2 min-w-[220px] animate-scale-in overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-float dark:border-slate-700 dark:bg-ink-850",
            align === "right" ? "right-0" : "left-0",
            panelClassName,
          )}
          onClick={() => setOpen(false)}
          onKeyDown={onMenuKeyDown}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function MenuItem({
  children,
  onClick,
  danger,
  active,
  icon,
}: {
  children: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  active?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition",
        danger
          ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
          : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
        active && "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300",
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {active ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
    </button>
  );
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function SelectChevron() {
  return <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-slate-400" />;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  loading,
  danger = true,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  loading?: boolean;
  danger?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={danger ? "danger" : "primary"} size="sm" loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600 dark:text-slate-300">
        This action takes effect immediately. Make sure you have selected the right item.
      </p>
    </Modal>
  );
}
