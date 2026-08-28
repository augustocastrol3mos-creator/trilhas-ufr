'use client'

import { useState, useTransition } from 'react'
import { Check, X, Lock, Target } from 'lucide-react'
import { salvarVeredito } from './acoes'

export type Linha = {
  competencia_id: string
  numero: number
  nome: string
  demonstrada: boolean | null
  observacao: string | null
  avaliado_em: string | null
  congelado: boolean
}

/**
 * O professor atesta, competência por competência, o que o aluno demonstrou.
 *
 * TRÊS ESTADOS, NÃO DOIS
 *
 * `null` (não avaliado), `true` e `false` são coisas diferentes, e a tela
 * precisa mostrar as três. "Não demonstrou" é um julgamento — alguém olhou e
 * concluiu que não. "Não avaliado" é ausência de julgamento. Colapsar os dois
 * num checkbox faria todo aluno não avaliado parecer reprovado, o que seria
 * injusto e falso.
 *
 * Só `true` vai para o certificado. `false` fica registrado para o professor
 * saber que já olhou aquele aluno, e some do documento.
 */
export default function VereditoCompetencias({
  matriculaId,
  linhas: iniciais,
}: {
  matriculaId: string
  linhas: Linha[]
}) {
  const [linhas, setLinhas] = useState(iniciais)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, iniciar] = useTransition()

  if (linhas.length === 0) return null

  const congelado = linhas[0]?.congelado ?? false

  function marcar(competenciaId: string, valor: boolean) {
    setErro(null)
    const anterior = linhas.find((l) => l.competencia_id === competenciaId)?.demonstrada ?? null

    // Se clicar de novo no mesmo valor, desmarca — é como se volta a "não
    // avaliado" sem precisar de um terceiro botão na tela.
    const novo = anterior === valor ? null : valor
    if (novo === null) {
      setErro('Para desfazer um veredito já salvo, fale com a coordenação.')
      return
    }

    setLinhas((ls) =>
      ls.map((l) => (l.competencia_id === competenciaId ? { ...l, demonstrada: novo } : l))
    )

    iniciar(async () => {
      const r = await salvarVeredito(matriculaId, competenciaId, novo)
      if (!r.ok) {
        setLinhas((ls) =>
          ls.map((l) => (l.competencia_id === competenciaId ? { ...l, demonstrada: anterior } : l))
        )
        setErro(r.erro ?? 'Não consegui salvar.')
      }
    })
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <h2 className="flex items-center gap-1.5 font-display text-base font-semibold text-ink">
        <Target className="h-4 w-4 text-primary" />
        Competências demonstradas
      </h2>

      {congelado ? (
        <p className="mt-2 flex items-start gap-2 rounded-md border border-border bg-canvas px-3 py-2.5 text-sm text-muted">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            O certificado já foi emitido e guarda o que estava aqui no momento da emissão.
            Para corrigir, é preciso revogar e reemitir em <span className="text-ink">/admin/certificados</span>.
          </span>
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted">
          Só o que você marcar como demonstrado sai impresso no certificado. Deixar em
          branco não reprova ninguém — significa que você ainda não avaliou.
        </p>
      )}

      <ul className="mt-4 divide-y divide-border border-t border-border">
        {linhas.map((l) => (
          <li key={l.competencia_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <span className="min-w-0 flex-1 text-sm text-ink">{l.nome}</span>

            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => marcar(l.competencia_id, true)}
                disabled={congelado || salvando}
                className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 ${
                  l.demonstrada === true
                    ? 'border-success bg-success-soft text-success'
                    : 'border-border text-muted hover:border-border-strong'
                }`}
              >
                <Check className="h-3.5 w-3.5" />
                Demonstrou
              </button>
              <button
                onClick={() => marcar(l.competencia_id, false)}
                disabled={congelado || salvando}
                className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 ${
                  l.demonstrada === false
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-border text-muted hover:border-border-strong'
                }`}
              >
                <X className="h-3.5 w-3.5" />
                Ainda não
              </button>
            </div>
          </li>
        ))}
      </ul>

      {erro && (
        <p className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{erro}</p>
      )}
    </div>
  )
}
