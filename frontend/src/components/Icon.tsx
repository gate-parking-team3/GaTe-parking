const PATHS = {
  bolt: <path d="M13 2.5 5 13.5h6.5L11 21.5l8-11h-6.5z" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
} as const;

export type IconName = keyof typeof PATHS;

/** Decorative 24x24 stroke icon. Pair it with text; icon-only buttons need an aria-label. */
export default function Icon({
  name,
  small = false,
}: {
  name: IconName;
  small?: boolean;
}) {
  return (
    <svg
      className={small ? "i i-sm" : "i"}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
