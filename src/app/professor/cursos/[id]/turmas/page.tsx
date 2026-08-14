import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Users, CalendarDays, MapPin, Lock, Unlock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { criarTurma, atualizarTurma, alternarInscricoes } from './actions'

export const dynamic = 'force-dynamic'

type Turma = {
  id: string
  identificador: string
  tipo: 'coorte' | 'continua'
  status: string
  encontro_data: string | null
  encontro_local: string | null
  inscricoes_ate: string | null
  vagas: number | null
  ocupadas: number
  instrutor_id: string | null
  instrutor_nome: string
}

const ROTULO_STATUS: Record<string, string> = {
  inscricoes_abertas: 'Inscrições abertas',
  em_andamento: 'Inscrições encerradas',
  encerrada: 'Turma encerrada',
}

const paraInput = (d: string | null, hora = false) =>
  d ? (hora ? new Date(d).toISOString().slice(0, 16) : d.slice(0, 10)) : ''

const campo =
  'mt-1 w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
const rotulo = 'block text-xs font-medium text-muted'

export default async function TurmasPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ erro?: string }>
}) {
  const { id } = await params
  const { erro } = await searchParams
  const supabase = await createClient()

  const { data: curso } = await supabase
    .from('curso')
    .select('id, titulo, modalidade')
    .eq('id', id)
    .single()

  if (!curso) notFound()

  // Autorização e contagem de matriculados vêm da RPC (0014): quem gere a
  // turma pode ser o autor do curso sem ser instrutor de nenhuma, e nesse
  // caso o RLS — corretamente — esconde as matrículas dele.
  const { data, error } = await supabase.rpc('turmas_do_curso', { p_curso: id })
  if (error) notFound()

  const turmas = (data ?? []) as Turma[]
  const hibrido = curso.modalidade === 'hibrido'

  return (
    <div>
      <Link
        href={`/professor/cursos/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {curso.titulo}
      </Link>

      <h1 className="mt-4 font-display text-2xl font-semibold text-ink">Turmas</h1>
      <p className="mt-1 text-sm text-muted">
        Cada oferta do curso é uma turma. Encerrar inscrições impede novas
        matrículas sem interromper quem já está fazendo a trilha.
      </p>

      {erro && (
        <p className="mt-4 rounded-md border border-danger-soft bg-danger-soft/40 px-3 py-2 text-sm text-danger">
          {erro}
        </p>
      )}

      <ul className="mt-6 space-y-4">
        {turmas.map((t) => {
          const encerrada = t.status === 'encerrada'
          const abertas = t.status === 'inscricoes_abertas'

          return (
            <li key={t.id} className="rounded-lg border border-border bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold text-ink">
                    Turma {t.identificador}
                  </h2>
                  <p className="mt-1 text-xs text-muted">
                    {t.tipo === 'continua' ? 'Contínua' : 'Coorte'} · instrutor:{' '}
                    {t.instrutor_nome}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    abertas
                      ? 'bg-primary-soft text-primary-dark'
                      : encerrada
                        ? 'bg-danger-soft text-danger'
                        : 'border border-border-strong text-muted'
                  }`}
                >
                  {ROTULO_STATUS[t.status] ?? t.status}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  {t.ocupadas} {t.ocupadas === 1 ? 'matriculado' : 'matriculados'}
                  {t.vagas != null ? ` de ${t.vagas}` : ' (sem limite)'}
                </span>
                {t.inscricoes_ate && (
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" />
                    inscrições até {new Date(t.inscricoes_ate + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </span>
                )}
                {t.encontro_local && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {t.encontro_local}
                  </span>
                )}
              </div>

              {encerrada ? (
                <p className="mt-4 border-t border-border pt-4 text-xs text-muted">
                  Turma fechada: notas congeladas e certificados emitidos. Para
                  alterar qualquer coisa, a coordenação precisa reabri-la antes.
                </p>
              ) : (
                <div className="mt-4 border-t border-border pt-4">
                  <form action={atualizarTurma} className="grid gap-3 sm:grid-cols-4">
                    <input type="hidden" name="cursoId" value={id} />
                    <input type="hidden" name="turmaId" value={t.id} />

                    <div>
                      <label className={rotulo}>Vagas</label>
                      <input
                        name="vagas"
                        type="number"
                        min={t.ocupadas || 1}
                        defaultValue={t.vagas ?? ''}
                        placeholder="ilimitado"
                        className={campo}
                      />
                    </div>

                    <div>
                      <label className={rotulo}>Inscrições até</label>
                      <input
                        name="inscricoesAte"
                        type="date"
                        defaultValue={paraInput(t.inscricoes_ate)}
                        className={campo}
                      />
                    </div>

                    {hibrido && (
                      <>
                        <div>
                          <label className={rotulo}>Encontro</label>
                          <input
                            name="encontroData"
                            type="datetime-local"
                            defaultValue={paraInput(t.encontro_data, true)}
                            className={campo}
                          />
                        </div>
                        <div>
                          <label className={rotulo}>Local</label>
                          <input
                            name="encontroLocal"
                            defaultValue={t.encontro_local ?? ''}
                            className={campo}
                          />
                        </div>
                      </>
                    )}

                    <div className="sm:col-span-4">
                      <button className="rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-ink hover:bg-canvas">
                        Salvar alterações
                      </button>
                    </div>
                  </form>

                  <form action={alternarInscricoes} className="mt-3">
                    <input type="hidden" name="cursoId" value={id} />
                    <input type="hidden" name="turmaId" value={t.id} />
                    <input type="hidden" name="abrir" value={abertas ? '0' : '1'} />
                    <button className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-dark">
                      {abertas ? (
                        <>
                          <Lock className="h-3.5 w-3.5" />
                          Encerrar inscrições
                        </>
                      ) : (
                        <>
                          <Unlock className="h-3.5 w-3.5" />
                          Reabrir inscrições
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <div className="mt-6 rounded-lg border border-dashed border-border-strong bg-surface p-5">
        <h2 className="font-display text-base font-semibold text-ink">Nova turma</h2>
        <p className="mt-1 text-xs text-muted">
          O tipo da turma vem da modalidade do curso
          {hibrido ? ' (híbrido: coorte com encontro presencial).' : ' (online: contínua).'}
        </p>

        <form action={criarTurma} className="mt-4 grid gap-3 sm:grid-cols-4">
          <input type="hidden" name="cursoId" value={id} />

          <div>
            <label className={rotulo}>Identificador *</label>
            <input name="identificador" required placeholder="2026/2" className={campo} />
          </div>

          <div>
            <label className={rotulo}>Vagas</label>
            <input name="vagas" type="number" min={1} placeholder="ilimitado" className={campo} />
          </div>

          <div>
            <label className={rotulo}>Inscrições até</label>
            <input name="inscricoesAte" type="date" className={campo} />
          </div>

          {hibrido && (
            <>
              <div>
                <label className={rotulo}>Encontro *</label>
                <input name="encontroData" type="datetime-local" required className={campo} />
              </div>
              <div className="sm:col-span-2">
                <label className={rotulo}>Local do encontro</label>
                <input name="encontroLocal" placeholder="Bloco X, sala 12" className={campo} />
              </div>
            </>
          )}

          <div className="sm:col-span-4">
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">
              Abrir turma
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
