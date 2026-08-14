'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarPlus, MapPin, Trash2, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { criarEncontro, removerEncontro, salvarChamada } from './actions'

export type Aluno = { matriculaId: string; nome: string }
export type Encontro = {
  id: string
  ordem: number
  titulo: string | null
  data: string
  local: string | null
  presentes: number
  marcados: string[]
}

const campo =
  'mt-1 w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
const rotulo = 'block text-xs font-medium text-muted'

function dataHora(d: string) {
  return new Date(d).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function GestorEncontros({
  turmaId,
  alunos,
  encontros,
  presencaMinima,
  bloqueado,
}: {
  turmaId: string
  alunos: Aluno[]
  encontros: Encontro[]
  presencaMinima: number
  bloqueado: boolean
}) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [aberto, setAberto] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  const [novo, setNovo] = useState({ titulo: '', data: '', local: '' })
  const [chamada, setChamada] = useState<Record<string, Record<string, boolean>>>(
    Object.fromEntries(
      encontros.map((e) => [
        e.id,
        Object.fromEntries(alunos.map((a) => [a.matriculaId, e.marcados.includes(a.matriculaId)])),
      ])
    )
  )

  function rodar(fn: () => Promise<{ ok: boolean; erro?: string }>) {
    setErro(null)
    iniciar(async () => {
      const r = await fn()
      if (!r.ok) setErro(r.erro ?? 'nao foi possivel concluir')
      else router.refresh()
    })
  }

  const necessarios = Math.ceil((encontros.length * presencaMinima) / 100)

  return (
    <div>
      {erro && (
        <p className="mb-4 rounded-md border border-danger-soft bg-danger-soft/40 px-3 py-2 text-sm text-danger">
          {erro}
        </p>
      )}

      {encontros.length > 0 && (
        <p className="mb-4 rounded-md border border-border bg-canvas px-3 py-2 text-xs text-muted">
          {encontros.length} {encontros.length === 1 ? 'encontro' : 'encontros'} · presença
          mínima de {presencaMinima}% ={' '}
          <strong className="text-ink">
            {necessarios} {necessarios === 1 ? 'presença' : 'presenças'}
          </strong>{' '}
          para o aluno ser habilitado ao certificado.
        </p>
      )}

      <ul className="space-y-3">
        {encontros.map((e) => {
          const expandido = aberto === e.id
          const marcados = chamada[e.id] ?? {}
          const total = Object.values(marcados).filter(Boolean).length

          return (
            <li key={e.id} className="rounded-lg border border-border bg-surface">
              <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div>
                  <h3 className="font-display text-base font-semibold text-ink">
                    {e.ordem}. {e.titulo || 'Encontro presencial'}
                  </h3>
                  <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                    <span>{dataHora(e.data)}</span>
                    {e.local && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        {e.local}
                      </span>
                    )}
                    <span>
                      {total} de {alunos.length} presentes
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setAberto(expandido ? null : e.id)}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-dark"
                  >
                    {expandido ? (
                      <>
                        <ChevronUp className="h-3.5 w-3.5" /> Fechar
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3.5 w-3.5" /> Chamada
                      </>
                    )}
                  </button>
                  {!bloqueado && (
                    <button
                      onClick={() => rodar(() => removerEncontro(turmaId, e.id))}
                      disabled={pendente}
                      aria-label={`Remover encontro ${e.ordem}`}
                      className="text-muted hover:text-danger disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {expandido && (
                <div className="border-t border-border p-4">
                  <div className="mb-3 flex gap-4">
                    <button
                      onClick={() =>
                        setChamada((c) => ({
                          ...c,
                          [e.id]: Object.fromEntries(alunos.map((a) => [a.matriculaId, true])),
                        }))
                      }
                      className="text-sm font-medium text-primary hover:text-primary-dark"
                    >
                      Marcar todos
                    </button>
                    <button
                      onClick={() =>
                        setChamada((c) => ({
                          ...c,
                          [e.id]: Object.fromEntries(alunos.map((a) => [a.matriculaId, false])),
                        }))
                      }
                      className="text-sm font-medium text-muted hover:text-ink"
                    >
                      Limpar
                    </button>
                  </div>

                  <ul className="grid gap-2 sm:grid-cols-2">
                    {alunos.map((a) => (
                      <li key={a.matriculaId}>
                        <label className="flex cursor-pointer items-center gap-2.5 rounded-md border border-border px-3 py-2 text-sm hover:border-border-strong">
                          <input
                            type="checkbox"
                            checked={!!marcados[a.matriculaId]}
                            onChange={() =>
                              setChamada((c) => ({
                                ...c,
                                [e.id]: { ...c[e.id], [a.matriculaId]: !c[e.id]?.[a.matriculaId] },
                              }))
                            }
                            className="h-4 w-4 accent-[var(--color-primary)]"
                          />
                          <span className="text-ink">{a.nome || '(sem nome)'}</span>
                        </label>
                      </li>
                    ))}
                  </ul>

                  {alunos.length === 0 && (
                    <p className="text-sm text-muted">Nenhum aluno matriculado nesta turma.</p>
                  )}

                  {!bloqueado && alunos.length > 0 && (
                    <button
                      onClick={() =>
                        rodar(() =>
                          salvarChamada(
                            turmaId,
                            e.id,
                            alunos.map((a) => ({
                              matricula: a.matriculaId,
                              presente: !!marcados[a.matriculaId],
                            }))
                          )
                        )
                      }
                      disabled={pendente}
                      className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" />
                      {pendente ? 'Salvando…' : 'Salvar chamada'}
                    </button>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {encontros.length === 0 && (
        <p className="rounded-lg border border-dashed border-border-strong p-6 text-center text-sm text-muted">
          Nenhum encontro cadastrado. Enquanto não houver ao menos um, nenhum aluno tem
          presença confirmada.
        </p>
      )}

      {!bloqueado && (
        <div className="mt-6 rounded-lg border border-dashed border-border-strong bg-surface p-5">
          <h3 className="flex items-center gap-2 font-display text-base font-semibold text-ink">
            <CalendarPlus className="h-4 w-4" />
            Novo encontro
          </h3>
          <p className="mt-1 text-xs text-muted">
            Adicionar um encontro muda o denominador do percentual e recalcula a presença
            de todos os alunos da turma.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div>
              <label className={rotulo}>Título</label>
              <input
                value={novo.titulo}
                onChange={(ev) => setNovo({ ...novo, titulo: ev.target.value })}
                placeholder="Aula 1 — abertura"
                className={campo}
              />
            </div>
            <div>
              <label className={rotulo}>Data e hora *</label>
              <input
                type="datetime-local"
                value={novo.data}
                onChange={(ev) => setNovo({ ...novo, data: ev.target.value })}
                className={campo}
              />
            </div>
            <div>
              <label className={rotulo}>Local</label>
              <input
                value={novo.local}
                onChange={(ev) => setNovo({ ...novo, local: ev.target.value })}
                placeholder="Bloco X, sala 12"
                className={campo}
              />
            </div>
          </div>

          <button
            onClick={() =>
              rodar(async () => {
                const r = await criarEncontro(turmaId, novo)
                if (r.ok) setNovo({ titulo: '', data: '', local: '' })
                return r
              })
            }
            disabled={pendente || !novo.data}
            className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          >
            Adicionar encontro
          </button>
        </div>
      )}
    </div>
  )
}
