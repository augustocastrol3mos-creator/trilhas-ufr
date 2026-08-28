'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, Copy, Trash2, TriangleAlert } from 'lucide-react'
import { clonarVersao, publicarVersao, excluirVersao } from './acoes'

export type Versao = {
  id: string
  versao: number
  titulo: string
  ativo: boolean
  publicado_em: string | null
  criado_em: string
  itens: number
  respostas: number
  competencias_sem_item: number
}

export default function PainelVersoes({
  versoes,
  selecionada,
  onSelecionar,
}: {
  versoes: Versao[]
  selecionada: string
  onSelecionar: (id: string) => void
}) {
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, iniciar] = useTransition()

  function agir(fn: () => Promise<{ ok: boolean; erro?: string }>) {
    setErro(null)
    iniciar(async () => {
      const r = await fn()
      if (!r.ok) setErro(r.erro ?? 'Não consegui concluir.')
    })
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold text-ink">Versões</h2>
        <button
          onClick={() => agir(() => clonarVersao())}
          disabled={ocupado}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-ink hover:border-border-strong disabled:opacity-50"
        >
          <Copy className="h-3.5 w-3.5" />
          Nova versão a partir da atual
        </button>
      </div>

      {erro && (
        <p className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{erro}</p>
      )}

      <ul className="mt-4 space-y-2">
        {versoes.map((v) => (
          <li
            key={v.id}
            className={`rounded-md border p-3 ${
              v.id === selecionada ? 'border-primary bg-primary-soft/30' : 'border-border'
            }`}
          >
            <button onClick={() => onSelecionar(v.id)} className="w-full text-left">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-display font-semibold text-ink">Versão {v.versao}</span>
                {v.ativo ? (
                  <span className="flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success">
                    <CheckCircle2 className="h-3 w-3" />
                    Em uso
                  </span>
                ) : (
                  <span className="rounded-full bg-canvas px-2.5 py-0.5 text-xs text-muted">
                    Rascunho
                  </span>
                )}
              </span>
              <span className="mt-1 block text-xs text-subtle">
                {v.itens} frases · {v.respostas} {v.respostas === 1 ? 'resposta' : 'respostas'}
              </span>
            </button>

            {!v.ativo && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => agir(() => publicarVersao(v.id))}
                  disabled={ocupado || v.competencias_sem_item > 0 || v.itens === 0}
                  title={
                    v.competencias_sem_item > 0
                      ? `${v.competencias_sem_item} competência(s) sem nenhuma frase`
                      : undefined
                  }
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-dark disabled:opacity-40"
                >
                  Publicar
                </button>
                <button
                  onClick={() => agir(() => excluirVersao(v.id))}
                  disabled={ocupado || v.respostas > 0}
                  title={v.respostas > 0 ? 'Já respondida: não pode ser apagada' : undefined}
                  className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-danger hover:border-danger disabled:opacity-40"
                >
                  <Trash2 className="h-3 w-3" />
                  Apagar
                </button>
              </div>
            )}

            {!v.ativo && v.competencias_sem_item > 0 && (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-accent">
                <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
                {v.competencias_sem_item} competência(s) sem nenhuma frase. Publicar assim
                deixaria o aluno com uma lacuna sem explicação no resultado.
              </p>
            )}
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs leading-relaxed text-subtle">
        Publicar troca o questionário que os alunos respondem. Quem já respondeu uma versão
        anterior <span className="text-ink">continua valendo</span> — não é obrigado a
        refazer, mas passa a poder, se quiser comparar.
      </p>
    </div>
  )
}
