/** Grafismo de fundo do hero: a trilha subindo até o certificado, em traço leve. */
export default function GrafismoHero() {
  return (
    <svg
      viewBox="0 0 600 400"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
    >
      <path
        d="M-20 380 C 90 380, 80 300, 170 300 C 270 300, 250 200, 350 200 C 440 200, 440 110, 540 110 L 640 110"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeDasharray="8 10"
        opacity="0.22"
      />
      <path
        d="M-20 300 C 90 300, 80 220, 170 220 C 270 220, 250 120, 350 120 C 440 120, 440 30, 540 30"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeDasharray="8 10"
        opacity="0.1"
      />
      {[
        [170, 300],
        [350, 200],
        [540, 110],
      ].map(([cx, cy], i) => (
        <g key={i} opacity={0.3 + i * 0.12}>
          <circle cx={cx} cy={cy} r="13" fill="#fff" opacity="0.14" />
          <circle cx={cx} cy={cy} r="5" fill="#fff" opacity="0.5" />
        </g>
      ))}
    </svg>
  )
}
