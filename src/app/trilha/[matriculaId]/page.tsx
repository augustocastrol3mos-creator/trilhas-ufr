import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, CalendarClock, Check, ChevronDown, Clock, FolderOpen, Info, Lock, PlayCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { ModuloTrilha } from '@/lib/blocos/schemas'
import { sessaoAtual } from '@/lib/auth'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export const dynamic = 'force-dynamic'

export default async function TrilhaPage({
  params,
}: { params: Promise<{ matriculaId: string }> }) {
  const { matriculaId } = await params
  const supabase = await createClient()

  const user = await sessaoAtual()
  if (!user) notFound()

  // Filtro explícito por dono. Não basta o RLS: a política matricula_admin
  // (e_admin()) soma por OR com matricula_propria, então uma conta admin
  // abriria a trilha de qualquer aluno pela URL.
  // As duas são independentes: ambas só precisam do matriculaId. Em série
  // custavam duas viagens de rede; em paralelo, uma. Não há risco de vazamento
  // por disparar a RPC antes da checagem de dono — modulos_trilha valida
  // e_dono_matricula por dentro, e o resultado é descartado no notFound().
  const [{ data: matricula }, { data, error }, { data: situacaoRaw }] =
    await Promise.all([
      supabase
        .from('matricula')
        .select('id, status, turma(identificador, encontro_data, encontro_local, curso(titulo, modalidade, apresentacao))')
        .eq('id', matriculaId)
        .eq('usuario_id', user.id)
        .single(),
      supabase.rpc('modulos_trilha', { p_matricula: matriculaId }),
      supabase.rpc('situacao_matricula', { p_matricula: matriculaId }),
    ])

  if (!matricula) notFound()

  if (error) {
    return (
      <div className="rounded-lg border border-danger-soft bg-danger-soft/40 p-4 text-sm text-danger">
        {error.message}
      </div>
    )
  }

  const modulos = (data ?? []) as ModuloTrilha[]

  const sit = (situacaoRaw ?? {}) as {
    expiraEm?: string | null
    expirada?: boolean
    diasRestantes?: number | null
    cursoArquivado?: boolean
    bloqueada?: boolean
  }
  const curso = (matricula as any).turma?.curso
  const turma = (matricula as any).turma

  // Onde o aluno parou: primeiro módulo liberado que ainda não terminou
  const atual = modulos.find((m) => m.liberado && !m.concluido)
  const totalObrig = modulos.reduce((s, m) => s + m.totalObrigatorios, 0)
  const totalFeitos = modulos.reduce((s, m) => s + m.concluidos, 0)
  const pctGeral = totalObrig === 0 ? 0 : Math.round((totalFeitos / totalObrig) * 100)
  const restante = modulos.filter((m) => !m.concluido).reduce((s, m) => s + m.tempoMinutos, 0)

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink">{curso?.titulo}</h1>

      {/* Apresentação: aberta enquanto o aluno não começou, recolhida depois.
          O estado sai de `totalFeitos`, que a página já calcula — nada de
          guardar "já viu isso" em lugar nenhum. */}
      {(curso as any)?.apresentacao && (
        <details open={totalFeitos === 0} className="group mt-4">
          <summary className="cursor-pointer list-none rounded-lg border border-border bg-surface px-4 py-3 text-sm font-medium text-ink hover:border-primary">
            <span className="flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" aria-hidden="true" />
              Sobre este curso
              <ChevronDown className="ml-auto h-4 w-4 text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
            </span>
          </summary>
          <div className="rounded-b-lg border border-t-0 border-border bg-surface px-4 pb-4 pt-1">
            <article className="prose prose-sm prose-neutral max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {(curso as any).apresentacao}
              </ReactMarkdown>
            </article>
          </div>
        </details>
      )}

      {/* Prazo invisível é armadilha: o aluno precisa saber quanto tempo tem
          ANTES de perder, não depois. */}
      {sit.bloqueada ? (
        <p className="mt-4 rounded-lg border border-danger bg-danger-soft px-4 py-3 text-sm leading-relaxed text-ink">
          <strong>Este curso foi encerrado pela coordenação</strong> e não aceita mais
          conclusões. Você pode rever o conteúdo, mas não é possível avançar nem emitir
          certificado. Procure a coordenação se tiver dúvida.
        </p>
      ) : sit.expirada ? (
        <p className="mt-4 rounded-lg border border-danger bg-danger-soft px-4 py-3 text-sm leading-relaxed text-ink">
          <strong>O prazo para concluir este curso terminou.</strong> Seu progresso está
          guardado — inscreva-se novamente no catálogo para retomar de onde parou, com um
          prazo novo.
        </p>
      ) : sit.expiraEm ? (
        <p
          className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
            (sit.diasRestantes ?? 99) <= 7
              ? 'border-accent bg-accent-soft text-ink'
              : 'border-border bg-surface text-muted'
          }`}
        >
          {(sit.diasRestantes ?? 0) <= 0
            ? 'Último dia para concluir este curso.'
            : `Você tem ${sit.diasRestantes} ${sit.diasRestantes === 1 ? 'dia' : 'dias'} para concluir, até ${new Date(sit.expiraEm).toLocaleDateString('pt-BR')}.`}
        </p>
      ) : sit.cursoArquivado ? (
        <p className="mt-4 rounded-lg border border-border bg-surface px-4 py-3 text-sm leading-relaxed text-muted">
          Este curso não é mais ofertado, mas <strong className="text-ink">você pode
          concluí-lo normalmente</strong> e receber o certificado.
        </p>
      ) : null}

      {/* Progresso geral do curso */}
      <div className="mt-4 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${pctGeral}%` }}
          />
        </div>
        <span className="shrink-0 text-sm font-medium text-muted">{pctGeral}%</span>
      </div>

      <Link
        href={`/trilha/${matriculaId}/materiais`}
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
        Materiais do curso
      </Link>

      {/* Continuar de onde parou */}
      {atual && (
        <div className="mt-6 rounded-lg border border-primary bg-primary-soft p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-primary-dark">
            {totalFeitos === 0 ? 'Comece por aqui' : 'Continue de onde parou'}
          </p>
          <p className="mt-2 font-display text-lg font-semibold text-ink">
            {atual.ordem}. {atual.titulo}
          </p>
          <p className="mt-1 text-sm text-muted">
            {atual.concluidos} de {atual.totalObrigatorios} itens · ~{atual.tempoMinutos} min
          </p>
          <Link
            href={`/trilha/${matriculaId}/${atual.moduloId}`}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark"
          >
            <PlayCircle className="h-4 w-4" />
            {atual.concluidos === 0 ? 'Começar módulo' : 'Continuar módulo'}
          </Link>
          {restante > 0 && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
              <Clock className="h-3.5 w-3.5" />
              Faltam cerca de {restante} min para concluir a trilha
            </p>
          )}
        </div>
      )}

      {matricula.status === 'trilha_concluida' && (
        <div className="mt-6 flex items-start gap-3 rounded-lg border border-accent-soft bg-accent-soft p-4 text-sm">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <p className="text-ink">
            <span className="font-medium">Trilha concluída.</span> Você está apto ao encontro
            presencial
            {turma?.encontro_data
              ? ` em ${new Date(turma.encontro_data).toLocaleDateString('pt-BR')}`
              : ''}
            {turma?.encontro_local ? `, ${turma.encontro_local}` : ''}.
          </p>
        </div>
      )}

      {matricula.status === 'certificado_emitido' && (
        <div className="mt-6 flex items-start gap-3 rounded-lg border border-primary-soft bg-primary-soft p-4 text-sm">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-dark" />
          <p className="text-ink">
            <span className="font-medium">Curso concluído.</span> Seu certificado já foi emitido —
            veja em{' '}
            <Link href="/certificados" className="font-medium text-primary-dark underline">
              Certificados
            </Link>
            .
          </p>
        </div>
      )}

      {matricula.status === 'aprovado' && (
        <div className="mt-6 flex items-start gap-3 rounded-lg border border-accent-soft bg-accent-soft p-4 text-sm">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <p className="text-ink">
            <span className="font-medium">Aprovado.</span> O certificado ainda não foi emitido.
            Confira se seu{' '}
            <Link href="/perfil" className="font-medium underline">
              nome completo
            </Link>{' '}
            está preenchido.
          </p>
        </div>
      )}

      {matricula.status === 'reprovado' && (
        <div className="mt-6 rounded-lg border border-danger-soft bg-danger-soft p-4 text-sm text-danger">
          Nota final abaixo do mínimo exigido pelo curso.
        </div>
      )}

      {/* Mapa da trilha */}
      <h2 className="mt-10 font-display text-lg font-semibold text-ink">Módulos</h2>

      <ol className="mt-4">
        {modulos.map((m, i) => {
          const ultimo = i === modulos.length - 1
          const ehAtual = atual?.moduloId === m.moduloId

          const conteudo = (
            <div className={`flex-1 pb-8 ${ehAtual ? 'rounded-lg bg-primary-soft/40 px-3 py-2 -mx-1' : ''}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className={`font-medium ${m.liberado ? 'text-ink' : 'text-subtle'}`}>
                    {m.titulo}
                  </p>
                  {m.descricao && <p className="mt-1 text-sm text-muted">{m.descricao}</p>}
                </div>
                <span className="shrink-0 text-xs text-subtle">~{m.tempoMinutos} min</span>
              </div>

              {m.totalObrigatorios > 0 && m.liberado && !m.concluido && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1 w-24 overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${(m.concluidos / m.totalObrigatorios) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-subtle">
                    {m.concluidos} de {m.totalObrigatorios}
                  </span>
                </div>
              )}

              {!m.liberado && (
                <p className="mt-2 text-xs text-subtle">
                  Conclua o módulo anterior para liberar este.
                </p>
              )}
            </div>
          )

          return (
            <li key={m.moduloId} className="flex gap-4">
              <div className="flex flex-col items-center">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium ${
                    m.concluido
                      ? 'bg-primary text-white'
                      : m.liberado
                        ? 'border-2 border-primary text-primary'
                        : 'border-2 border-border-strong text-subtle'
                  }`}
                >
                  {m.concluido ? (
                    <Check className="h-4 w-4" />
                  ) : m.liberado ? (
                    m.ordem
                  ) : (
                    <Lock className="h-3.5 w-3.5" />
                  )}
                </span>
                {!ultimo && (
                  <span
                    className={`mt-1 w-px flex-1 ${m.concluido ? 'bg-primary' : 'bg-border-strong'}`}
                    style={{ minHeight: '2.5rem' }}
                  />
                )}
              </div>

              {m.liberado ? (
                <Link
                  href={`/trilha/${matriculaId}/${m.moduloId}`}
                  className="-mt-1 flex-1 rounded-lg px-3 py-1 hover:bg-surface"
                >
                  {conteudo}
                </Link>
              ) : (
                <div className="flex-1 opacity-60">{conteudo}</div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
