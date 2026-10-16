export function Logo({ size = 26 }: { size?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#101114" />
        <path d="M8 21.5h5l4-11h7" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="24" cy="10.5" r="2.4" fill="#bfb3f8" />
      </svg>
      <span style={{ fontSize: 21, fontWeight: 600, letterSpacing: "-0.035em" }}>aislerun</span>
    </span>
  );
}
