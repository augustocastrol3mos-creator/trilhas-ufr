'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import { quizPublicoSchema } from '@/lib/blocos/schemas'
import { submeterQuiz } from '@/app/trilha/actions'
import type { PropsBloco } from './BlocoRenderer'

type Detalhe = {
  id: string
  correta: boolean
  gabarito?: string | boolean | string[] | null
  feedback?: string | null
}

type Resultado = {
  nota: number
  aprovado: boolean
  tentativa: number
  maxTentativas: number
  mostrouGabarito: boolean
  detalhes: Detalhe[]
}

export default function BlocoQuiz({ bloco, matriculaId, estado, onConcluir }: PropsBloco) {
  const parsed = quizPublicoSchema.safeParse(bloco.config)
  const tentativasFeitas = Array.isArray(bloco.dados?.tentativas)
    ? (bloco.dados.tentativas as unknown[]).length
    : 0

  const [respostas, setRespostas] = useState<Record<string, unknown>>({})
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  if (!parsed.success) {
    return <p className="text-sm text-danger">Configuração inválida deste bloco.</p>
  }

  const quiz = parsed.data
  const aprovado = estado === 'concluido' || Boolean(resultado?.aprovado)
  const usadas = tentativasFeitas + (resultado ? 1 : 0)
  const restantes = Math.max(0, quiz.maxTentativas - usadas)
  const travado = aprovado || restantes === 0

  const detalhePorQuestao = new Map((resultado?.detalhes ?? []).map((d) => [d.id, d]))

  function marcarMultipla(qid: string, altId: string, marcado: boolean) {
    setRespostas((r) => {
      const atual = Array.isArray(r[qid]) ? (r[qid] as string[]) : []
      return { ...r, [qid]: marcado ? [...atual, altId] : atual.filter((x) => x !== altId) }
    })
  }

  function gabaritoTexto(d: Detalhe, tipo: string) {
    if (d.gabarito == null) return null
    if (tipo === 'verdadeiro_falso') return d.gabarito ? 'Verdadeiro' : 'Falso'
    const q = quiz.questoes.find((x) => x.id === d.id)
    if (!q || q.tipo === 'verdadeiro_falso') return null
    const ids = Array.isArray(d.gabarito) ? d.gabarito : [String(d.gabarito)]
    return q.alternativas.filter((a) => ids.includes(a.id)).map((a) => a.texto).join(', ')
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="mb-4 text-sm text-muted">
        Nota mínima {quiz.notaMinima}%
        {!aprovado && ` · tentativa ${Math.min(usadas + 1, quiz.maxTentativas)} de ${quiz.maxTentativas}`}
      </p>

      <ol className="space-y-6">
        {quiz.questoes.map((q, i) => {
          const d = detalhePorQuestao.get(q.id)
          const cor = !d
            ? 'border-border'
            : d.correta
              ? 'border-primary bg-primary-soft/40'
              : 'border-danger bg-danger-soft/40'

          return (
            <li key={q.id} className={`rounded-lg border p-4 ${cor}`}>
              <div className="flex items-start gap-2">
                {d && (
                  <span className="mt-0.5 shrink-0">
                    {d.correta ? (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    ) : (
                      <XCircle className="h-4 w-4 text-danger" />
                    )}
                  </span>
                )}
                <p className="font-medium text-ink">
                  {i + 1}. {q.enunciado}
                </p>
              </div>

              {q.tipo === 'verdadeiro_falso' && (
                <div className="mt-3 flex gap-4">
                  {[true, false].map((v) => (
                    <label key={String(v)} className="flex items-center gap-2 text-sm text-ink">
                      <input
                        type="radio"
                        name={q.id}
                        disabled={travado}
                        checked={respostas[q.id] === v}
                        onChange={() => setRespostas((r) => ({ ...r, [q.id]: v }))}
                      />
                      {v ? 'Verdadeiro' : 'Falso'}
                    </label>
                  ))}
                </div>
              )}

              {q.tipo === 'multipla_escolha' && (
                <div className="mt-3 space-y-1.5">
                  {q.alternativas.map((a) => (
                    <label key={a.id} className="flex items-center gap-2 text-sm text-ink">
                      <input
                        type="radio"
                        name={q.id}
                        disabled={travado}
                        checked={respostas[q.id] === a.id}
                        onChange={() => setRespostas((r) => ({ ...r, [q.id]: a.id }))}
                      />
                      {a.texto}
                    </label>
                  ))}
                </div>
              )}

              {q.tipo === 'multipla_resposta' && (
                <div className="mt-3 space-y-1.5">
                  {q.alternativas.map((a) => (
                    <label key={a.id} className="flex items-center gap-2 text-sm text-ink">
                      <input
                        type="checkbox"
                        disabled={travado}
                        checked={
                          Array.isArray(respostas[q.id]) &&
                          (respostas[q.id] as string[]).includes(a.id)
                        }
                        onChange={(e) => marcarMultipla(q.id, a.id, e.target.checked)}
                      />
                      {a.texto}
                    </label>
                  ))}
                </div>
              )}

              {d && !d.correta && gabaritoTexto(d, q.tipo) && (
                <p className="mt-3 border-l-2 border-primary pl-3 text-sm text-ink">
                  <span className="font-medium">Resposta correta:</span> {gabaritoTexto(d, q.tipo)}
                </p>
              )}
              {d?.feedback && <p className="mt-2 text-sm italic text-muted">{d.feedback}</p>}
            </li>
          )
        })}
      </ol>

      {!travado && (
        <button
          disabled={pendente}
          onClick={() =>
            iniciar(async () => {
              setErro(null)
              const r = await submeterQuiz(matriculaId, bloco.blocoId, respostas)
              if (r.erro) setErro(r.erro)
              else {
                const res = r as unknown as Resultado
                setResultado(res)
                if (res.aprovado) onConcluir()
              }
            })
          }
          className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {pendente ? 'Corrigindo...' : resultado ? 'Tentar novamente' : 'Enviar respostas'}
        </button>
      )}

      {resultado && (
        <div
          className={`mt-4 rounded-md p-3 text-sm ${
            resultado.aprovado ? 'bg-primary-soft text-primary-dark' : 'bg-accent-soft text-ink'
          }`}
        >
          <p className="font-medium">
            Nota {resultado.nota}% · {resultado.aprovado ? 'aprovado neste bloco' : 'abaixo do mínimo'}
          </p>
          {!resultado.aprovado && (
            <p className="mt-1">
              {restantes > 0
                ? `Você tem mais ${restantes} ${restantes === 1 ? 'tentativa' : 'tentativas'}.`
                : 'Não restam tentativas. Procure o professor do curso.'}
            </p>
          )}
          {!resultado.mostrouGabarito && !resultado.aprovado && (
            <p className="mt-1 text-xs">
              As questões erradas estão marcadas em vermelho. O gabarito é liberado após a aprovação.
            </p>
          )}
        </div>
      )}

      {aprovado && !resultado && (
        <p className="mt-4 text-sm text-primary-dark">
          Você já concluiu este quiz{bloco.nota != null ? ` com nota ${bloco.nota}%` : ''}.
        </p>
      )}

      {erro && <p className="mt-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{erro}</p>}
    </div>
  )
}
