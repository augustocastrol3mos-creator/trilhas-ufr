import { Clock, MapPin, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { inscrever } from './actions'

export const dynamic = 'force-dynamic'

type TurmaRow = {
  id: string
  identificador: string
  tipo: 'coorte' | 'continua'
  encontro_data: string | null
  encontro_local: string | null
  inscricoes_ate: string | null
}

type CursoRow = {
  id: string
  slug: string
  titulo: string
  descricao: string | null
  carga_horaria: number
  modalidade: 'hibrido' | 'online'
  turma: TurmaRow[]
}

type VagaRow = {
  turma_id: string
  ocupadas: number
  restantes: number | null
  aberta: boolean
}

const dataBR = (d: string | null) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : null

export default async function CursosPage({
  searchParams,
}: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('curso')
    .select(
      'id, slug, titulo, descricao, carga_horaria, modalidade, turma(id, identificador, tipo, encontro_data, encontro_local, inscricoes_ate)'
    )
    .eq('status', 'publicado')
    .order('titulo')

  if (error) {
    return (
      <div className="rounded-lg border border-danger-soft bg-danger-soft/40 p-4 text-sm text-danger">
        {error.message}
      </div>
    )
  }

  // Vagas e prazo vêm de uma RPC porque contar matrículas exige ler linhas de
  // outras pessoas, que o RLS esconde — e deve esconder. A função devolve só o
  // agregado. Se a chamada falhar, a lista ainda renderiza: o banco continua
  // sendo a autoridade sobre quem pode se inscrever, esta tela só antecipa.
  const { data: vagasData } = await supabase.rpc('turmas_abertas')
  const vagas = new Map(
    ((vagasData ?? []) as VagaRow[]).map((v) => [v.turma_id, v])
  )

  const cursos = (data ?? []) as CursoRow[]

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink">Cursos</h1>
      <p className="mt-1 text-sm text-muted">Cursos publicados e abertos para inscrição.</p>

      {erro && (
        <p className="mt-4 rounded-md border border-danger-soft bg-danger-soft/40 px-3 py-2 text-sm text-danger">
          {erro}
        </p>
      )}

      <ul className="mt-6 space-y-4">
        {cursos.map((c) => (
          <li key={c.id} className="rounded-lg border border-border bg-surface p-5">
            <div className="flex items-start justify-between gap-4">
              <h2 className="font-display text-base font-semibold text-ink">{c.titulo}</h2>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  c.modalidade === 'online'
                    ? 'bg-primary-soft text-primary-dark'
                    : 'border border-border-strong text-muted'
                }`}
              >
                {c.modalidade === 'online' ? '100% online' : 'híbrido'}
              </span>
            </div>

            <p className="mt-2 text-sm text-muted">{c.descricao}</p>

            <div className="mt-3 flex items-center gap-1.5 text-xs text-muted">
              <Clock className="h-3.5 w-3.5" />
              {c.carga_horaria} horas
            </div>

            {c.turma.map((t) => {
              const v = vagas.get(t.id)
              const aberta = v?.aberta ?? true
              const prazo = dataBR(t.inscricoes_ate)

              return (
                <form
                  key={t.id}
                  action={inscrever}
                  className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4"
                >
                  <input type="hidden" name="turmaId" value={t.id} />
                  <button
                    disabled={!aberta}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {aberta ? 'Inscrever-se' : 'Inscrições encerradas'}
                  </button>

                  <span className="flex items-center gap-1.5 text-sm text-muted">
                    {t.tipo === 'continua' ? (
                      'Turma contínua'
                    ) : (
                      <>
                        <MapPin className="h-3.5 w-3.5" />
                        Turma {t.identificador} · encontro em{' '}
                        {t.encontro_data
                          ? new Date(t.encontro_data).toLocaleDateString('pt-BR')
                          : 'a definir'}
                      </>
                    )}
                  </span>

                  {v?.restantes != null && (
                    <span className="flex items-center gap-1.5 text-xs text-muted">
                      <Users className="h-3.5 w-3.5" />
                      {v.restantes > 0
                        ? `${v.restantes} ${v.restantes === 1 ? 'vaga' : 'vagas'}`
                        : 'sem vagas'}
                    </span>
                  )}

                  {prazo && aberta && (
                    <span className="text-xs text-muted">inscrições até {prazo}</span>
                  )}
                </form>
              )
            })}
          </li>
        ))}
      </ul>

      {cursos.length === 0 && (
        <p className="mt-6 text-sm text-muted">Nenhum curso publicado no momento.</p>
      )}
    </div>
  )
}
