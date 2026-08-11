'use client'

import { Check } from 'lucide-react'
import type { BlocoAluno, EstadoProgresso } from '@/lib/blocos/schemas'
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

export type PropsBloco = {
  bloco: BlocoAluno
  matriculaId: string
  estado: EstadoProgresso
  onConcluir: () => void
}

export default function BlocoRenderer({
  bloco, matriculaId, estado, onConcluir,
}: PropsBloco) {
  const Componente = REGISTRY[bloco.tipo as keyof typeof REGISTRY]
  const concluido = estado === 'concluido'

  return (
    <section
      id={`bloco-${bloco.blocoId}`}
      className="scroll-mt-20 border-t border-border py-8 first:border-t-0 first:pt-0"
    >
      <header className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="font-display text-lg font-semibold text-ink">{bloco.titulo}</h2>

        <div className="flex shrink-0 items-center gap-2">
          {concluido ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary-dark">
              <Check className="h-3 w-3" />
              concluído
            </span>
          ) : bloco.obrigatorio ? (
            <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">
              obrigatório
            </span>
          ) : (
            <span className="rounded-full border border-border-strong px-2.5 py-0.5 text-xs text-muted">
              opcional
            </span>
          )}
        </div>
      </header>

      {Componente ? (
        <Componente
          bloco={bloco}
          matriculaId={matriculaId}
          estado={estado}
          onConcluir={onConcluir}
        />
      ) : (
        <p className="text-sm text-muted">
          Bloco do tipo &quot;{bloco.tipo}&quot; ainda não implementado nesta versão.
        </p>
      )}
    </section>
  )
}
