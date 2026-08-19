import Link from 'next/link'
import { Clock, ChevronRight, CheckCircle2, Award } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { sessaoAtual } from '@/lib/auth'

export const dynamic = 'force-dynamic'

type Turma = { id: string }
type CursoRow = {
  id: string
  slug: string
  titulo: string
  descricao: string | null
  carga_horaria: number
  modalidade: 'hibrido' | 'online'
  categoria: { nome: string; slug: string } | null
  turma: Turma[]
}
type MinhaMatricula = { id: string; turma_id: string; status: string }
type VagaRow = { turma_id: string; aberta: boolean; restantes: number | null }

export default async function CursosPage({
  searchParams,
}: { searchParams: Promise<{ erro?: string; cat?: string }> }) {
  const { erro, cat } = await searchParams
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('curso')
    .select(
      'id, slug, titulo, descricao, carga_horaria, modalidade, categoria(nome, slug), turma(id)'
    )
    .eq('status', 'publicado')
    .order('titulo')

  if (error) {
    return (
      <div className="rounded-lg border border-danger-soft bg-danger-soft p-4 text-sm text-danger">
        {error.message}
      </div>
    )
  }

  const usuario = await sessaoAtual()

  const [{ data: vagasData }, { data: minhas }] = await Promise.all([
    supabase.rpc('turmas_abertas'),
    usuario
      ? supabase.from('matricula').select('id, turma_id, status').eq('usuario_id', usuario.id)
      : Promise.resolve({ data: [] as MinhaMatricula[] }),
  ])

  const vagas = new Map(((vagasData ?? []) as VagaRow[]).map((v) => [v.turma_id, v]))
  const meus = (minhas ?? []) as MinhaMatricula[]
  const todos = (data ?? []) as unknown as CursoRow[]

  // Só entram no filtro as categorias que têm curso publicado: chip que leva a
  // uma lista vazia é pior do que chip nenhum.
  const cats = Array.from(
    new Map(todos.filter((c) => c.categoria).map((c) => [c.categoria!.slug, c.categoria!])).values()
  ).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  const cursos = cat ? todos.filter((c) => c.categoria?.slug === cat) : todos

  // Estado do curso para o aluno, resolvido uma vez por card. A ordem importa:
  // "já faço" e "já concluí" vêm antes de vaga e prazo, porque quem entrou não
  // perde acesso quando a inscrição fecha — mesma regra que a 0013 e a 0018
  // aplicam no banco.
  function estado(c: CursoRow) {
    const ids = new Set(c.turma.map((t) => t.id))
    const minha = meus.find((m) => ids.has(m.turma_id))

    if (minha && (minha.status === 'aprovado' || minha.status === 'certificado_emitido'))
      return { rotulo: 'Concluído', tom: 'success', Icon: Award } as const
    if (minha) return { rotulo: 'Em andamento', tom: 'primary', Icon: CheckCircle2 } as const

    const abertas = c.turma.filter((t) => vagas.get(t.id)?.aberta)
    if (abertas.length === 0)
      return { rotulo: 'Sem turma aberta', tom: 'neutro', Icon: null } as const

    const restantes = abertas
      .map((t) => vagas.get(t.id)?.restantes)
      .filter((n): n is number => n != null)

    if (restantes.length > 0 && Math.max(...restantes) <= 5)
      return { rotulo: `Últimas ${Math.max(...restantes)} vagas`, tom: 'accent', Icon: null } as const

    return { rotulo: 'Inscrições abertas', tom: 'primary', Icon: null } as const
  }

  const tons: Record<string, string> = {
    success: 'bg-success-soft text-success',
    primary: 'bg-primary-soft text-primary-dark',
    accent: 'bg-accent-soft text-accent',
    neutro: 'border border-border-strong text-muted',
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink">Cursos</h1>
      <p className="mt-1 text-sm text-muted">
        Atividades complementares e cursos de extensão da UFR, com certificado de
        validação pública.
      </p>

      {erro && (
        <p className="mt-4 rounded-md border border-danger-soft bg-danger-soft px-3 py-2 text-sm text-danger">
          {erro}
        </p>
      )}

      {cats.length > 0 && (
        <nav className="mt-5 flex flex-wrap gap-2" aria-label="Filtrar por categoria">
          <Link
            href="/cursos"
            aria-current={!cat ? 'page' : undefined}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
              !cat ? 'bg-primary text-white' : 'border border-border-strong text-muted hover:text-ink'
            }`}
          >
            Todas
          </Link>
          {cats.map((k) => (
            <Link
              key={k.slug}
              href={`/cursos?cat=${k.slug}`}
              aria-current={cat === k.slug ? 'page' : undefined}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
                cat === k.slug
                  ? 'bg-primary text-white'
                  : 'border border-border-strong text-muted hover:text-ink'
              }`}
            >
              {k.nome}
            </Link>
          ))}
        </nav>
      )}

      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {cursos.map((c) => {
          const e = estado(c)
          return (
            <li key={c.id}>
              {/* O card inteiro é link. A inscrição acontece na página do curso,
                  onde há espaço para mostrar data, local e vagas de cada turma
                  sem empilhar formulários dentro do cartão. */}
              <Link
                href={`/cursos/${c.slug}`}
                className="flex h-full flex-col rounded-lg border border-border bg-surface p-5 transition-colors hover:border-primary"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-xs font-medium text-primary">
                    {c.categoria?.nome ?? 'Sem categoria'}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${tons[e.tom]}`}
                  >
                    {e.rotulo}
                  </span>
                </div>

                <h2 className="mt-2 font-display text-base font-semibold text-ink">{c.titulo}</h2>

                {c.descricao && (
                  <p className="mt-1.5 line-clamp-2 text-sm text-muted">{c.descricao}</p>
                )}

                <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-xs text-muted">
                  <span className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {c.carga_horaria}h
                    </span>
                    <span>{c.modalidade === 'online' ? '100% online' : 'híbrido'}</span>
                  </span>
                  <span className="flex items-center gap-1 font-medium text-primary">
                    Ver curso
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>

      {cursos.length === 0 && (
        <p className="mt-6 rounded-lg border border-dashed border-border-strong p-8 text-center text-sm text-muted">
          {cat ? 'Nenhum curso publicado nesta categoria.' : 'Nenhum curso publicado no momento.'}
        </p>
      )}
    </div>
  )
}
