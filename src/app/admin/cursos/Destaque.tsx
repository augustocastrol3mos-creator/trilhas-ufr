'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, X } from 'lucide-react'
import { definirDestaque } from './acoes'

export default function Destaque({
  cursoId, nota, publicado,
}: { cursoId: string; nota: string | null; publicado: boolean }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [texto, setTexto] = useState(nota ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function rodar(valor: string) {
    setErro(null)
    iniciar(async () => {
      const r = await definirDestaque(cursoId, valor)
      if (!r.ok) setErro(r.erro ?? 'nao foi possivel concluir')
      else { setAberto(false); router.refresh() }
    })
  }

  if (!publicado && !nota) return null

  return (
    <div className="mt-3">
      {erro && (
        <p className="mb-2 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{erro}</p>
      )}

      {nota && !aberto && (
        <div className="rounded-md border border-primary-soft bg-primary-soft p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary-dark">
            <Sparkles className="h-3.5 w-3.5" />
            Em destaque na página inicial
          </p>
          <p className="mt-1 text-sm italic text-ink">{nota}</p>
          <div className="mt-2 flex gap-4 text-sm font-medium">
            <button onClick={() => setAberto(true)} className="text-primary hover:underline">
              Editar
            </button>
            <button
              onClick={() => rodar('')}
              disabled={pendente}
              className="text-muted hover:text-danger disabled:opacity-50"
            >
              Remover destaque
            </button>
          </div>
        </div>
      )}

      {!nota && !aberto && (
        <button
          onClick={() => setAberto(true)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Destacar na página inicial
        </button>
      )}

      {aberto && (
        <div className="rounded-md border border-border bg-canvas p-4">
          <div className="flex items-start justify-between gap-3">
            <label className="block flex-1 text-xs font-medium text-muted">
              Por que este curso agora
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={2}
                placeholder="Ex: turma nova com vagas abertas, útil para quem está no 1º semestre"
                className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-ink"
              />
            </label>
            <button onClick={() => setAberto(false)} aria-label="Fechar">
              <X className="h-4 w-4 text-muted hover:text-ink" />
            </button>
          </div>

          <p className="mt-1 text-xs text-subtle">
            É esta frase que o aluno lê no cartão. Sem ela, o destaque vira só
            &ldquo;olha esse&rdquo; — e um espaço que sempre diz a mesma coisa deixa de
            ser olhado. Máximo de três cursos em destaque.
          </p>

          <button
            onClick={() => rodar(texto)}
            disabled={pendente || texto.trim().length < 15}
            className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {pendente ? 'Salvando…' : 'Salvar destaque'}
          </button>
        </div>
      )}
    </div>
  )
}
