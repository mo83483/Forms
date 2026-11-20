export default function Logo({ size = 40, withWord = true }: { size?: number; withWord?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5 select-none" dir="ltr">
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="afs-g" x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
            <stop stopColor="#22d3ee" />
            <stop offset="0.5" stopColor="#6366f1" />
            <stop offset="1" stopColor="#a855f7" />
          </linearGradient>
          <linearGradient id="afs-g2" x1="20" y1="18" x2="46" y2="46" gradientUnits="userSpaceOnUse">
            <stop stopColor="#e879f9" />
            <stop offset="1" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <path
          d="M32 3 57 17.5v29L32 61 7 46.5v-29L32 3Z"
          stroke="url(#afs-g)"
          strokeWidth="4.5"
          strokeLinejoin="round"
          fill="rgba(99,102,241,0.10)"
        />
        <path
          d="M22 39.5c4-1.2 5.6-9 7.6-13.4 1.5 10.2 5.4 13.2 8 9.6 1.8-2.4 3.4-8.4 8.4-10.2"
          stroke="url(#afs-g2)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <circle cx="32" cy="32" r="2.6" fill="#22d3ee" />
      </svg>
      {withWord && (
        <span className="leading-tight">
          <span className="block text-[15px] font-bold tracking-tight text-white">
            AI Form <span className="gradient-text">Solver</span>
          </span>
          <span className="block text-[9.5px] font-medium tracking-[0.18em] text-slate-500 uppercase">
            Google Forms × AI
          </span>
        </span>
      )}
    </span>
  );
}
