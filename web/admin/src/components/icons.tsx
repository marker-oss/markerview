import type { ReactElement } from 'react'

const PATHS: Record<string, ReactElement> = {
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </>
  ),
  list: (
    <>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <circle cx="3.5" cy="6" r="1" />
      <circle cx="3.5" cy="12" r="1" />
      <circle cx="3.5" cy="18" r="1" />
    </>
  ),
  widget: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M3 9h18M8 13h6" />
    </>
  ),
  panel: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M14.5 4v16" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.8v3M12 18.2v3M4.2 7.4l2.6 1.5M17.2 15.1l2.6 1.5M4.2 16.6l2.6-1.5M17.2 8.9l2.6-1.5" />
    </>
  ),
  mp: (
    <>
      <path d="M3 4h2l2.4 11h10.4l2.2-8H6.2" />
      <circle cx="9.5" cy="20" r="1.4" />
      <circle cx="17" cy="20" r="1.4" />
    </>
  ),
  pulse: <path d="M3 12h4l2.5-7 5 14 2.5-7h4" />,
  card: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M3 10h18" />
    </>
  ),
  out: <path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 8l-4 4 4 4M6 12h10" />,
  chev: <path d="m6 9 6 6 6-6" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  burger: <path d="M4 7h16M4 12h16M4 17h16" />,
  grip: (
    <>
      <path d="M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01" />
    </>
  ),
  star: (
    <path d="M12 2.8l2.85 5.78 6.38.93-4.62 4.5 1.09 6.36L12 17.4l-5.7 3-1.09-6.37-4.62-4.49 6.38-.93L12 2.8z" />
  ),
}

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg
      className="ic"
      style={{ width: size, height: size }}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name] ?? null}
    </svg>
  )
}
