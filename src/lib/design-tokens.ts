// ─── Design tokens — single source of truth ───────────────────────────────────

export const colors = {
  primary: '#1a5c6b',
  accent: '#a8c8cf',
  bg: {
    base: '#f7f9fa',      // light mode (future)
    dark: '#000000',       // current dark theme
    card: '#0d0d0d',       // card surface on dark
    cardHover: '#161616',
  },
  text: {
    primary: '#ffffff',
    secondary: '#a0a0a0',
    muted: '#6b6b6b',
    accent: '#d4a85a',     // gold/amber — "Locked in" + nav active state
  },
  status: {
    success: '#4ade80',    // green dot, "online", "active"
    warning: '#d4a85a',    // amber, "at risk"
    danger: '#ef4444',
    info: '#a8c8cf',
  },
  border: {
    subtle: 'rgba(255,255,255,0.06)',
    default: 'rgba(255,255,255,0.1)',
    strong: 'rgba(255,255,255,0.2)',
  },
} as const

export const spacing = {
  xs: '0.25rem',  // 4
  sm: '0.5rem',   // 8
  md: '1rem',     // 16
  lg: '1.5rem',   // 24
  xl: '2rem',     // 32
  '2xl': '3rem',  // 48
} as const

export const radius = {
  sm: '0.5rem',
  md: '0.75rem',
  lg: '1rem',
  xl: '1.5rem',
  full: '9999px',
} as const

export const type = {
  // section headers (uppercase, tracked)
  section: 'text-xs uppercase tracking-[0.2em] text-neutral-500 font-medium',
  // big numbers in stat tiles
  statValue: 'text-3xl font-semibold tracking-tight',
  // stat labels under numbers
  statLabel: 'text-xs text-neutral-500',
  // card titles
  cardTitle: 'text-base font-semibold',
  // body
  body: 'text-sm text-neutral-300',
} as const
