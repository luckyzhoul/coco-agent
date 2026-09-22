interface IconProps {
  className?: string;
}

/** Panel glyph with the divider on the left — toggles the session sidebar. */
export function SidebarLeftIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="1.75" stroke="currentColor" strokeWidth="1.1" />
      <path d="M6 2.75v10.5" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

/** Panel glyph with the divider on the right — toggles the space panel. */
export function SidebarRightIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="1.75" stroke="currentColor" strokeWidth="1.1" />
      <path d="M10 2.75v10.5" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}
