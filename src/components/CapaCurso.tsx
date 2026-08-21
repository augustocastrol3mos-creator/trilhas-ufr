import Image from 'next/image'

/**
 * Capa do curso — imagem enviada pelo professor, ou capa gerada.
 *
 * POR QUE EXISTE UMA CAPA GERADA
 *
 * Se a capa fosse simplesmente opcional, metade dos cursos teria imagem e
 * metade não — e catálogo com buraco no lugar da imagem parece QUEBRADO, que é
 * pior do que não ter capa nenhuma. Se fosse obrigatória, cada professor
 * viraria designer à força e alguém teria que dar suporte a isso.
 *
 * A saída é todo curso nascer com uma capa apresentável: um grafismo derivado
 * do próprio título, na paleta institucional. Quem quiser subir foto sobe por
 * cima; quem não quiser tem algo coerente. O catálogo fica homogêneo nos dois
 * cenários.
 *
 * A capa NUNCA carrega informação que não esteja escrita ao lado dela — por
 * isso `alt=""`: para leitor de tela ela é decoração, e repetir o título que já
 * está no cartão só atrapalharia.
 */

// Paleta institucional. O índice vem do título, então o mesmo curso tem sempre
// a mesma capa — não muda a cada carregamento.
const TONS = [
  { de: '#20376B', para: '#0D6AB0' },
  { de: '#0D6AB0', para: '#2E7D46' },
  { de: '#16264A', para: '#20376B' },
  { de: '#2E7D46', para: '#53B366' },
  { de: '#20376B', para: '#53B366' },
]

function tomDe(chave: string) {
  let n = 0
  for (let i = 0; i < chave.length; i++) n = (n * 31 + chave.charCodeAt(i)) % 997
  return TONS[n % TONS.length]
}

function iniciais(titulo: string) {
  return titulo
    .split(/\s+/)
    .filter((p) => p.length > 2)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export default function CapaCurso({
  titulo, capaUrl, categoria, className = '',
}: {
  titulo: string
  capaUrl?: string | null
  categoria?: string | null
  className?: string
}) {
  if (capaUrl) {
    return (
      <div className={`relative overflow-hidden bg-canvas ${className}`}>
        <Image
          src={capaUrl}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, 400px"
          className="object-cover"
        />
      </div>
    )
  }

  const tom = tomDe(titulo)

  return (
    <div
      aria-hidden="true"
      className={`relative overflow-hidden ${className}`}
      style={{ background: `linear-gradient(135deg, ${tom.de} 0%, ${tom.para} 100%)` }}
    >
      {/* Triângulos: eco do grafismo institucional, sem reproduzir o logotipo —
          o manual da UFR proíbe recriar a marca, e formas geométricas soltas
          não são a marca. */}
      <svg
        viewBox="0 0 400 160"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full opacity-[0.16]"
      >
        <polygon points="330,10 390,55 330,100" fill="#fff" />
        <polygon points="322,58 262,103 322,148" fill="#fff" />
        <polygon points="392,96 440,132 392,168" fill="#fff" />
      </svg>

      <div className="relative flex h-full flex-col justify-between p-4">
        <span className="font-display text-2xl font-bold leading-none text-white/85">
          {iniciais(titulo) || 'UFR'}
        </span>
        {categoria && (
          <span className="text-[11px] font-medium uppercase tracking-wide text-white/70">
            {categoria}
          </span>
        )}
      </div>
    </div>
  )
}
