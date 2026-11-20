// The better-auth-nuvion mark: one payment (pink node) splitting into three shares. Same drawing as the docs site.
export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect
        width="64"
        height="64"
        rx="16"
        fill="#300402"
        stroke="#4a2622"
        strokeWidth="1"
      />
      <g
        fill="none"
        stroke="#F6DCD5"
        strokeOpacity=".55"
        strokeWidth="3"
        strokeLinecap="round"
      >
        <path d="M17 32h6" />
        <path d="M23 32C33 32 36 17 47 17" />
        <path d="M23 32h24" />
        <path d="M23 32C33 32 36 47 47 47" />
      </g>
      <circle cx="17" cy="32" r="6" fill="#F63080" />
      <circle cx="48" cy="17" r="4.5" fill="#F63080" />
      <circle cx="48" cy="32" r="4.5" fill="#F6DCD5" />
      <circle cx="48" cy="47" r="4.5" fill="#E8590C" />
    </svg>
  );
}
