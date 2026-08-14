import Link from 'next/link'
import { Clock, MapPin, Users, CheckCircle2, Award } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { inscrever } from './actions'
import { sessaoAtual } from '@/lib/auth'

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

type MinhaMatricula = { id: string; turma_id: string; status: string }

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
  //
  // As matrículas do próprio usuário são consulta separada e com filtro
  // explícito por dono: a política matricula_admin (e_admin()) soma por OR com
  // matricula_propria, então sem o .eq() uma conta de coordenação veria as
  // matrículas de todo mundo e o catálogo diria "você já está inscrito" em
  // curso nenhum dela. É o padrão da seção 3 do ESTADO_DO_PROJETO.
  const usuario = await sessaoAtual()

  const [{ data: vagasData }, { data: minhas }] = await Promise.all([
    supabase.rpc('turmas_abertas'),
    usuario
      ? supabase
          .from('matricula')
          .select('id, turma_id, status')
          .eq('usuario_id', usuario.id)
      : Promise.resolve({ data: [] as MinhaMatricula[] }),
  ])

  const vagas = new Map(
    ((vagasData ?? []) as VagaRow[]).map((v) => [v.turma_id, v])
  )

  // turma_id -> matricula_id, para o botão poder linkar direto para a trilha
  const inscrito = new Map(
    ((minhas ?? []) as MinhaMatricula[]).map((m) => [m.turma_id, m.id])
  )

  const cursos = (data ?? []) as CursoRow[]

  // Cursos já concluídos. A trava real está na 0018 (inscrever recusa), aqui é
  // só antecipar. O mapa turma -> curso sai dos dados que a página já carregou,
  // então não custa consulta nenhuma.
  const cursoDaTurma = new Map<string, string>()
  for (const c of cursos) for (const t of c.turma) cursoDaTurma.set(t.id, c.id)

  const concluidos = new Set(
    ((minhas ?? []) as MinhaMatricula[])
      .filter((m) => m.status === 'aprovado' || m.status === 'certificado_emitido')
      .map((m) => cursoDaTurma.get(m.turma_id))
      .filter((x): x is string => Boolean(x))
  )

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
              const minhaMatricula = inscrito.get(t.id)
              const jaConcluiu = concluidos.has(c.id)

              // Já matriculado tem precedência sobre turma fechada: quem entrou
              // não perde o acesso quando a inscrição encerra. Mesma regra que
              // a 0013 aplica no banco, agora refletida na tela.
              if (minhaMatricula) {
                return (
                  <div
                    key={t.id}
                    className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4"
                  >
                    <Link
                      href={`/trilha/${minhaMatricula}`}
                      className="inline-flex items-center gap-1.5 rounded-md border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary-soft"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Continuar curso
                    </Link>
                    <span className="flex items-center gap-1.5 text-sm text-muted">
                      {t.tipo === 'continua' ? (
                        'Você já está inscrito'
                      ) : (
                        <>
                          <MapPin className="h-3.5 w-3.5" />
                          Turma {t.identificador} · você já está inscrito
                        </>
                      )}
                    </span>
                  </div>
                )
              }

              // Concluiu o curso em outra turma: não entra de novo. A regra
              // vem depois do "já matriculado" de propósito — quem foi
              // aprovado NESTA turma continua vendo "Continuar curso" e
              // mantendo acesso à própria trilha e ao próprio certificado.
              if (jaConcluiu) {
                return (
                  <div
                    key={t.id}
                    className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4"
                  >
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-muted">
                      <Award className="h-3.5 w-3.5" />
                      Curso já concluído
                    </span>
                    <Link
                      href="/certificados"
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Ver meu certificado
                    </Link>
                  </div>
                )
              }

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

                  {v?.restantes != null && aberta && (
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
