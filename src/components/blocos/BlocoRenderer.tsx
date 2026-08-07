'use client'

import type { BlocoAluno } from '@/lib/blocos/schemas'
import BlocoTexto from './BlocoTexto'
import BlocoCheckpoint from './BlocoCheckpoint'
import BlocoVideo from './BlocoVideo'
import BlocoQuiz from './BlocoQuiz'

// Registry: adicionar um tipo é uma entrada aqui + um componente. Nada mais.
const REGISTRY = {
  texto: BlocoTexto,
  checkpoint: BlocoCheckpoint,
  video: BlocoVideo,
  quiz: BlocoQuiz,
} as const

export default function BlocoRenderer({
  bloco, matriculaId,
}: { bloco: BlocoAluno; matriculaId: string }) {
  const Componente = REGISTRY[bloco.tipo as keyof typeof REGISTRY]

  return (
    <section className="border-t border-border py-8 first:border-t-0 first:pt-0">
      <header className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="font-display text-lg font-semibold text-ink">{bloco.titulo}</h2>
        {bloco.obrigatorio && (
          <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">
            obrigatório
          </span>
        )}
      </header>

      {Componente ? (
        <Componente bloco={bloco} matriculaId={matriculaId} />
      ) : (
        <p className="text-sm text-muted">
          Bloco do tipo &quot;{bloco.tipo}&quot; ainda não implementado nesta versão.
        </p>
      )}
    </section>
  )
}
