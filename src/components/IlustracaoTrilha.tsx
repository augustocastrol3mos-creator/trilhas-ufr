/**
 * Ilustração da landing: uma trilha de conhecimento subindo por etapas,
 * terminando no selo do certificado. Identidade própria, sem copiar o SUAP.
 */
export default function IlustracaoTrilha() {
  return (
    <svg viewBox="0 0 420 320" className="h-auto w-full" role="img" aria-labelledby="ilu-titulo">
      <title id="ilu-titulo">Trilha de aprendizado que termina em um certificado</title>

      {/* trilha */}
      <path
        d="M40 270 C 110 270, 100 200, 160 200 C 220 200, 210 130, 270 130 C 320 130, 320 80, 360 80"
        fill="none"
        stroke="var(--color-border-strong)"
        strokeWidth="3"
        strokeDasharray="7 7"
        strokeLinecap="round"
      />

      {/* etapas concluídas */}
      {[
        { cx: 40, cy: 270 },
        { cx: 160, cy: 200 },
        { cx: 270, cy: 130 },
      ].map((p, i) => (
        <g key={i}>
          <circle cx={p.cx} cy={p.cy} r="15" fill="var(--color-primary)" />
          <path
            d={`M${p.cx - 6} ${p.cy} l4 4 l8 -8`}
            fill="none"
            stroke="#fff"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      ))}

      {/* livro aberto, na base da trilha */}
      <g transform="translate(28, 60)">
        <rect x="0" y="0" width="150" height="100" rx="6" fill="var(--color-primary-soft)" />
        <path d="M75 18 V88" stroke="var(--color-primary)" strokeWidth="2.5" />
        <path
          d="M75 18 C 60 10, 38 10, 20 16 V 84 C 38 78, 60 78, 75 88"
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path
          d="M75 18 C 90 10, 112 10, 130 16 V 84 C 112 78, 90 78, 75 88"
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {[30, 42, 54].map((y) => (
          <g key={y}>
            <path d={`M32 ${y} h32`} stroke="var(--color-primary)" strokeWidth="2" opacity="0.35" strokeLinecap="round" />
            <path d={`M88 ${y} h32`} stroke="var(--color-primary)" strokeWidth="2" opacity="0.35" strokeLinecap="round" />
          </g>
        ))}
      </g>

      {/* certificado no topo da trilha */}
      <g transform="translate(310, 30)">
        <rect x="0" y="0" width="96" height="70" rx="6" fill="var(--color-surface)" stroke="var(--color-primary)" strokeWidth="2.5" />
        <path d="M14 20 h50" stroke="var(--color-ink)" strokeWidth="3" strokeLinecap="round" />
        <path d="M14 32 h68" stroke="var(--color-border-strong)" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M14 42 h44" stroke="var(--color-border-strong)" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="72" cy="52" r="13" fill="var(--color-primary)" />
        <path d="M66 52 l4 4 l8 -8" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  )
}
