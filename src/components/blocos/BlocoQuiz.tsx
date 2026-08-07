'use client'

import { useState, useTransition } from 'react'
import { quizPublicoSchema, type BlocoAluno } from '@/lib/blocos/schemas'
import { submeterQuiz } from '@/app/trilha/actions'

type Resultado = { nota: number; aprovado: boolean; tentativa: number; maxTentativas: number }

export default function BlocoQuiz({
  bloco, matriculaId,
}: { bloco: BlocoAluno; matriculaId: string }) {
  const parsed = quizPublicoSchema.safeParse(bloco.config)
  const tentativasFeitas = Array.isArray(bloco.dados?.tentativas)
    ? (bloco.dados.tentativas as unknown[]).length
    : 0

  const [respostas, setRespostas] = useState<Record<string, unknown>>({})
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  if (!parsed.success) {
    return <p className="text-sm text-red-600">Configuração inválida deste bloco.</p>
  }

  const quiz = parsed.data
  const aprovado = bloco.estado === 'concluido' || resultado?.aprovado
  const restantes = quiz.maxTentativas - tentativasFeitas - (resultado ? 1 : 0)

  function marcarMultipla(qid: string, altId: string, marcado: boolean) {
    setRespostas((r) => {
      const atual = Array.isArray(r[qid]) ? (r[qid] as string[]) : []
      return {
        ...r,
        [qid]: marcado ? [...atual, altId] : atual.filter((x) => x !== altId),
      }
    })
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="mb-4 text-sm text-muted">
        Nota mínima {quiz.notaMinima}% · tentativa {tentativasFeitas + 1} de {quiz.maxTentativas}
      </p>

      <ol className="space-y-6">
        {quiz.questoes.map((q, i) => (
          <li key={q.id}>
            <p className="font-medium">
              {i + 1}. {q.enunciado}
            </p>

            {q.tipo === 'verdadeiro_falso' && (
              <div className="mt-2 flex gap-4">
                {[true, false].map((v) => (
                  <label key={String(v)} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={q.id}
                      disabled={aprovado}
                      checked={respostas[q.id] === v}
                      onChange={() => setRespostas((r) => ({ ...r, [q.id]: v }))}
                    />
                    {v ? 'Verdadeiro' : 'Falso'}
                  </label>
                ))}
              </div>
            )}

            {q.tipo === 'multipla_escolha' && (
              <div className="mt-2 space-y-1.5">
                {q.alternativas.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={q.id}
                      disabled={aprovado}
                      checked={respostas[q.id] === a.id}
                      onChange={() => setRespostas((r) => ({ ...r, [q.id]: a.id }))}
                    />
                    {a.texto}
                  </label>
                ))}
              </div>
            )}

            {q.tipo === 'multipla_resposta' && (
              <div className="mt-2 space-y-1.5">
                {q.alternativas.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      disabled={aprovado}
                      onChange={(e) => marcarMultipla(q.id, a.id, e.target.checked)}
                    />
                    {a.texto}
                  </label>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>

      {!aprovado && restantes > 0 && (
        <button
          disabled={pendente}
          onClick={() =>
            iniciar(async () => {
              setErro(null)
              const r = await submeterQuiz(matriculaId, bloco.blocoId, respostas)
              if (r.erro) setErro(r.erro)
              else setResultado(r as unknown as Resultado)
            })
          }
          className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {pendente ? 'Corrigindo...' : 'Enviar respostas'}
        </button>
      )}

      {resultado && (
        <p className={`mt-4 text-sm ${resultado.aprovado ? 'text-primary-dark' : 'text-accent'}`}>
          Nota {resultado.nota}%. {resultado.aprovado ? 'Aprovado neste bloco.' : `Abaixo do mínimo. Tentativas restantes: ${Math.max(0, restantes)}.`}
        </p>
      )}
      {aprovado && !resultado && (
        <p className="mt-4 text-sm text-primary-dark">
          Você já concluiu este quiz{bloco.nota != null ? ` com nota ${bloco.nota}%` : ''}.
        </p>
      )}
      {erro && <p className="mt-4 text-sm text-red-600">{erro}</p>}
    </div>
  )
}
