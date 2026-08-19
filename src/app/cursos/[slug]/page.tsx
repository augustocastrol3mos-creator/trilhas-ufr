import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Clock, MapPin, Users, CalendarDays, CheckCircle2, Award, Layers } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { sessaoAtual } from '@/lib/auth'
import { inscrever } from '../actions'

export const dynamic = 'force-dynamic'

type Turma = {
  id: string
  identificador: string
  tipo: 'coorte' | 'continua'
  encontro_data: string | null
  encontro_local: string | null
  inscricoes_ate: string | null
}

const dataBR = (d: string | null) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : null

export default async function CursoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ erro?: string }>
}) {
  const { slug } = await params
  const { erro } = await searchParams
  const supabase = await createClient()

  const { data: curso } = await supabase
    .from('curso')
    .select(
      'id, slug, titulo, descricao, carga_horaria, modalidade, nota_minima_final, categoria(nome, slug), turma(id, identificador, tipo, encontro_data, encontro_local, inscricoes_ate)'
    )
    .eq('slug', slug)
    .eq('status', 'publicado')
    .maybeSingle()

  if (!curso) notFound()

  const c = curso as any
  const usuario = await sessaoAtual()

  // Três consultas independentes, em paralelo. As matrículas trazem filtro
  // explícito por dono: a política matricula_admin (e_admin) soma por OR com
  // matricula_propria, então sem o .eq() uma conta de coordenação veria as
  // matrículas de todo mundo.
  const [{ data: modulos }, { data: vagasData }, { data: minhas }] = await Promise.all([
    supabase.from('modulo').select('id, ordem, titulo, descricao').eq('curso_id', c.id).order('ordem'),
    supabase.rpc('turmas_abertas'),
    usuario
      ? supabase.from('matricula').select('id, turma_id, status').eq('usuario_id', usuario.id)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const vagas = new Map(((vagasData ?? []) as any[]).map((v) => [v.turma_id, v]))
  const inscrito = new Map(((minhas ?? []) as any[]).map((m) => [m.turma_id, m.id]))

  const turmasDoCurso = new Set((c.turma ?? []).map((t: Turma) => t.id))
  const jaConcluiu = ((minhas ?? []) as any[]).some(
    (m) =>
      turmasDoCurso.has(m.turma_id) &&
      (m.status === 'aprovado' || m.status === 'certificado_emitido')
  )

  const turmas = (c.turma ?? []) as Turma[]

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/cursos" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" />
        Todos os cursos
      </Link>

      <header className="mt-4">
        {c.categoria && (
          <p className="text-sm font-medium text-primary">{c.categoria.nome}</p>
        )}
        <h1 className="mt-1 font-display text-3xl font-semibold text-ink">{c.titulo}</h1>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            {c.carga_horaria} horas
          </span>
          <span className="flex items-center gap-1.5">
            {c.modalidade === 'online' ? 'Totalmente online' : 'Híbrido — trilha online + encontro presencial'}
          </span>
          {c.nota_minima_final != null && (
            <span>Nota mínima {c.nota_minima_final}</span>
          )}
        </div>

        {c.descricao && <p className="mt-4 text-base text-ink">{c.descricao}</p>}
      </header>

      {erro && (
        <p className="mt-5 rounded-md border border-danger-soft bg-danger-soft px-3 py-2 text-sm text-danger">
          {erro}
        </p>
      )}

      {jaConcluiu && (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg border border-success-soft bg-success-soft p-4">
          <Award className="h-5 w-5 text-success" />
          <p className="text-sm text-ink">
            Você já concluiu este curso e não pode cursá-lo novamente.
          </p>
          <Link href="/certificados" className="text-sm font-medium text-primary hover:underline">
            Ver meu certificado
          </Link>
        </div>
      )}

      {(modulos ?? []).length > 0 && (
        <section className="mt-8">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
            <Layers className="h-4 w-4" />
            O que você vai percorrer
          </h2>
          <ol className="mt-3 space-y-2">
            {(modulos ?? []).map((m: any, i: number) => (
              <li key={m.id} className="rounded-lg border border-border bg-surface p-4">
                <p className="text-sm font-medium text-ink">
                  <span className="text-subtle">{i + 1}.</span> {m.titulo}
                </p>
                {m.descricao && <p className="mt-1 text-sm text-muted">{m.descricao}</p>}
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-subtle">
            Os módulos abrem em sequência: o seguinte destrava quando o anterior é concluído.
          </p>
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-display text-lg font-semibold text-ink">Turmas</h2>

        {turmas.length === 0 && (
          <p className="mt-3 rounded-lg border border-dashed border-border-strong p-6 text-center text-sm text-muted">
            Nenhuma turma cadastrada neste curso ainda.
          </p>
        )}

        <ul className="mt-3 space-y-3">
          {turmas.map((t) => {
            const v = vagas.get(t.id)
            const aberta = v?.aberta ?? false
            const minha = inscrito.get(t.id)
            const prazo = dataBR(t.inscricoes_ate)

            return (
              <li key={t.id} className="rounded-lg border border-border bg-surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="font-display text-base font-semibold text-ink">
                      {t.tipo === 'continua' ? 'Turma contínua' : `Turma ${t.identificador}`}
                    </h3>

                    <div className="mt-2 space-y-1 text-sm text-muted">
                      {t.encontro_data && (
                        <p className="flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5" />
                          Encontro em {new Date(t.encontro_data).toLocaleString('pt-BR', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                      )}
                      {t.encontro_local && (
                        <p className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" />
                          {t.encontro_local}
                        </p>
                      )}
                      {aberta && v?.restantes != null && (
                        <p className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" />
                          {v.restantes > 0
                            ? `${v.restantes} ${v.restantes === 1 ? 'vaga restante' : 'vagas restantes'}`
                            : 'sem vagas'}
                        </p>
                      )}
                      {aberta && prazo && <p>Inscrições até {prazo}</p>}
                      {t.tipo === 'continua' && !t.encontro_data && (
                        <p>Sem encontro presencial — você faz no seu ritmo.</p>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0">
                    {minha ? (
                      <Link
                        href={`/trilha/${minha}`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary-soft"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Continuar curso
                      </Link>
                    ) : jaConcluiu ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-muted">
                        Curso já concluído
                      </span>
                    ) : (
                      <form action={inscrever}>
                        <input type="hidden" name="turmaId" value={t.id} />
                        <input type="hidden" name="voltarPara" value={`/cursos/${c.slug}`} />
                        <button
                          disabled={!aberta}
                          className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {aberta ? 'Inscrever-se' : 'Inscrições encerradas'}
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
