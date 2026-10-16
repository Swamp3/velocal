export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'soft' | 'link' | 'quiet';
export type ButtonSize = 'sm' | 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center font-medium rounded-[var(--radius-default)] ' +
  'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-[var(--color-primary)] disabled:opacity-50 disabled:pointer-events-none ' +
  'cursor-pointer';

const SIZES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-2.5',
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] ' +
    'active:bg-[var(--color-primary-dark)]',
  secondary: 'bg-[var(--color-secondary)] text-white hover:opacity-90 active:opacity-80',
  outline:
    'border border-[var(--color-border)] text-[var(--color-text)] ' +
    'hover:bg-[var(--color-bg-alt)] active:bg-[var(--color-border)]',
  ghost:
    'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-alt)] ' +
    'hover:text-[var(--color-text)] active:bg-[var(--color-border)]',
  danger: 'bg-[var(--color-danger)] text-white hover:opacity-90 active:opacity-80',
  /** Quiet call to action, e.g. "Edit" next to a row. */
  soft:
    'text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 ' +
    'active:bg-[var(--color-primary)]/20',
  /** Text link that triggers an action. Ignores the size padding. */
  link: 'text-[var(--color-primary)] hover:underline',
  /** Like `link`, but grey: for secondary text actions. */
  quiet: 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
};

/** One source of truth for how a button looks, for `ui-button` and `[uiButton]` alike. */
export function buttonClasses(variant: ButtonVariant, size: ButtonSize): string {
  const sizeClasses = variant === 'link' || variant === 'quiet' ? 'text-sm gap-1' : SIZES[size];
  return `${BASE} ${sizeClasses} ${VARIANTS[variant]}`;
}
