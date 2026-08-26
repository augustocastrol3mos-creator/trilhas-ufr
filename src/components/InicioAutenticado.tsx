import Link from 'next/link'
import {
  Award, CalendarDays, ClipboardCheck, Clock, MapPin, PencilLine,
  Sparkles, TrendingUp, UserCheck,
} from 'lucide-react'
import CapaCurso from './CapaCurso'

type CursoVitrine = {
  id: string
  slug: string
  titulo: string
  descricao?: string | null
  cargaHoraria: number
  modalidade: string
  capaUrl: string | null
  categoria: string | null
  nota?: string | null
}

export type Inicio = {
  papel?: string
  emAndamento?: {
    matriculaId: string
    cursoTitulo: string
    capaUrl: string | null
    categoria: string | null
    total: number
    concluidos: number
  }[]
  proximosEncontros?: {
    data: string
    local: string | null
    titulo: string | null
    cursoTitulo: string
    turma: string
    presente: boolean
  }[]
  presencaPendente?: {
    cursoTitulo: string
    presentes: number
    total: number
    minima: number
  }[]
  horas?: number
  certificados?: number
  chamadasPendentes?: {
    turmaId: string
    turma: string
    cursoTitulo: string
    encontro: string | null
    data: string
  }[]
  turmasAtivas?: number
  solicitacoesPendentes?: number
  cursosProntos?: number
}

export type Vitrine = {
  destaques?: CursoVitrine[]
  rotacao?: CursoVitrine[]
  novidades?: CursoVitrine[]
}

const dataHora = (d: string) =>
  new Date(d).toLocaleString('pt-BR', {
    weekday: 'short', day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })

export default function InicioAutenticado({
  nome, inicio, vitrine, falhou = false,
}: { nome: string; inicio: Inicio; vitrine: Vitrine; falhou?: boolean }) {
  const emAndamento = inicio.emAndamento ?? []
  const encontros = inicio.proximosEncontros ?? []
  const presenca = inicio.presencaPendente ?? []
  const chamadas = inicio.chamadasPendentes ?? []
  const destaques = vitrine.destaques ?? []
  const rotacao = vitrine.rotacao ?? []
  const novidades = vitrine.novidades ?? []

  const ehProfessor = inicio.papel === 'instrutor' || inicio.papel === 'admin'
  const ehCoordenacao = inicio.papel === 'admin'
  const primeiroNome = nome.split(' ')[0] || ''

  const pendenciasCoord =
    (inicio.solicitacoesPendentes ?? 0) + (inicio.cursosProntos ?? 0)

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink md:text-3xl">
        {primeiroNome ? `Olá, ${primeiroNome}` : 'Início'}
      </h1>

      {/* Mostrar "0h" quando a consulta falhou é pior do que não mostrar nada:
          o número parece um fato e a pessoa acredita nele. */}
      {falhou && (
        <p className="mt-4 rounded-lg border border-danger-soft bg-danger-soft px-4 py-3 text-sm text-danger">
          Não foi possível carregar o seu resumo agora. Os números abaixo podem estar
          desatualizados — seus cursos e certificados continuam corretos em Meus cursos e
          Certificados.
        </p>
      )}

      {/* ---------- o que exige ação ---------- */}
      {(encontros.length > 0 || chamadas.length > 0 || pendenciasCoord > 0) && (
        <section className="mt-6 space-y-3">
          {encontros.map((e, i) => (
            <div
              key={i}
              className="flex flex-wrap items-start gap-3 rounded-lg border border-accent-soft bg-accent-soft p-4"
            >
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">
                  {e.presente ? 'Encontro presencial' : 'Encontro presencial chegando'} ·{' '}
                  {e.cursoTitulo}
                </p>
                <p className="mt-0.5 text-sm text-muted">
                  {dataHora(e.data)}
                  {e.local && <> · {e.local}</>}
                  {e.turma && <> · turma {e.turma}</>}
                </p>
              </div>
            </div>
          ))}

          {chamadas.length > 0 && (
            <div className="rounded-lg border border-primary-soft bg-primary-soft p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-ink">
                <ClipboardCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                {chamadas.length === 1
                  ? 'Uma chamada ainda não foi feita'
                  : `${chamadas.length} chamadas ainda não foram feitas`}
              </p>
              <ul className="mt-2 space-y-1">
                {chamadas.map((c, i) => (
                  <li key={i} className="text-sm">
                    <Link
                      href={`/professor/turmas/${c.turmaId}/encontros`}
                      className="text-primary-dark hover:underline"
                    >
                      {c.cursoTitulo} · turma {c.turma} · {dataHora(c.data)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {ehCoordenacao && pendenciasCoord > 0 && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border bg-surface p-4 text-sm">
              {(inicio.solicitacoesPendentes ?? 0) > 0 && (
                <Link
                  href="/admin/solicitacoes"
                  className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                >
                  <PencilLine className="h-3.5 w-3.5" />
                  {inicio.solicitacoesPendentes} pedido(s) de correção de dados
                </Link>
              )}
              {(inicio.cursosProntos ?? 0) > 0 && (
                <Link
                  href="/admin/cursos"
                  className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {inicio.cursosProntos} curso(s) prontos para publicar
                </Link>
              )}
            </div>
          )}
        </section>
      )}

      {/* ---------- continue ---------- */}
      {emAndamento.length > 0 && (
        <section className="mt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="font-display text-lg font-semibold text-ink">Continue de onde parou</h2>
            <Link href="/meus-cursos" className="text-sm font-medium text-primary hover:underline">
              Todos os meus cursos
            </Link>
          </div>

          <ul className="mt-3 grid gap-4 sm:grid-cols-2">
            {emAndamento.map((m) => {
              const pct = m.total > 0 ? Math.round((m.concluidos / m.total) * 100) : 0
              return (
                <li key={m.matriculaId}>
                  <Link
                    href={`/trilha/${m.matriculaId}`}
                    className="flex h-full overflow-hidden rounded-lg border border-border bg-surface transition-colors hover:border-primary"
                  >
                    <CapaCurso
                      titulo={m.cursoTitulo}
                      capaUrl={m.capaUrl}
                      className="h-auto w-24 shrink-0"
                    />
                    <div className="min-w-0 flex-1 p-4">
                      {m.categoria && (
                        <p className="text-xs font-medium text-primary">{m.categoria}</p>
                      )}
                      <p className="mt-0.5 font-display text-sm font-semibold text-ink">
                        {m.cursoTitulo}
                      </p>

                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-canvas">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-1.5 text-xs text-muted">
                        {m.concluidos} de {m.total} etapas · {pct}%
                      </p>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* ---------- presença ---------- */}
      {presenca.length > 0 && (
        <section className="mt-8">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
            <UserCheck className="h-4 w-4 text-primary" aria-hidden="true" />
            Sua presença
          </h2>
          <ul className="mt-3 space-y-2">
            {presenca.map((p, i) => (
              <li
                key={i}
                className="flex flex-wrap items-baseline justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm"
              >
                <span className="text-ink">{p.cursoTitulo}</span>
                <span className="text-muted">
                  {p.presentes} de {p.total} encontros · mínimo {p.minima}%
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------- destaque ou rotação ---------- */}
      {(destaques.length > 0 || rotacao.length > 0) && (
        <section className="mt-10">
          <h2 className="font-display text-lg font-semibold text-ink">
            {destaques.length > 0 ? 'Indicados pela coordenação' : 'Conheça o catálogo'}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {destaques.length > 0
              ? 'Escolhidos pela coordenação para esta oferta.'
              : 'Uma amostra do que está aberto. Muda a cada dia.'}
          </p>

          <ul className="mt-4 grid gap-4 sm:grid-cols-3">
            {(destaques.length > 0 ? destaques : rotacao).map((c) => (
              <li key={c.id}>
                <Link
                  href={`/cursos/${c.slug}`}
                  className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface transition-colors hover:border-primary"
                >
                  <CapaCurso
                    titulo={c.titulo}
                    capaUrl={c.capaUrl}
                    categoria={c.categoria}
                    className="h-28 w-full"
                  />
                  <div className="flex flex-1 flex-col p-4">
                    <p className="font-display text-sm font-semibold text-ink">{c.titulo}</p>

                    {c.nota ? (
                      <p className="mt-2 border-l-2 border-primary pl-2.5 text-sm italic leading-relaxed text-muted">
                        {c.nota}
                      </p>
                    ) : (
                      c.descricao && (
                        <p className="mt-1.5 line-clamp-2 text-sm text-muted">{c.descricao}</p>
                      )
                    )}

                    <p className="mt-auto flex items-center gap-3 pt-3 text-xs text-muted">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {c.cargaHoraria}h
                      </span>
                      <span>{c.modalidade === 'online' ? '100% online' : 'híbrido'}</span>
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------- novidades ---------- */}
      {novidades.length > 0 && (
        <section className="mt-10">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
              <TrendingUp className="h-4 w-4 text-primary" aria-hidden="true" />
              Publicados recentemente
            </h2>
            <Link href="/cursos" className="text-sm font-medium text-primary hover:underline">
              Ver catálogo
            </Link>
          </div>

          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {novidades.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/cursos/${c.slug}`}
                  className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 transition-colors hover:border-primary"
                >
                  <CapaCurso
                    titulo={c.titulo}
                    capaUrl={c.capaUrl}
                    className="h-12 w-12 shrink-0 rounded-md"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{c.titulo}</p>
                    <p className="text-xs text-muted">
                      {c.categoria ? `${c.categoria} · ` : ''}
                      {c.cargaHoraria}h
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------- rodapé de números ---------- */}
      {!falhou && (
      <section className="mt-10 grid gap-4 sm:grid-cols-3">
        <Numero
          Icon={Clock}
          valor={`${inicio.horas ?? 0}h`}
          rotulo="em atividades complementares"
          href="/perfil"
        />
        <Numero
          Icon={Award}
          valor={String(inicio.certificados ?? 0)}
          rotulo="certificados emitidos"
          href="/certificados"
        />
        {ehProfessor ? (
          <Numero
            Icon={ClipboardCheck}
            valor={String(inicio.turmasAtivas ?? 0)}
            rotulo="turmas ativas"
            href="/professor"
          />
        ) : (
          <Numero
            Icon={MapPin}
            valor="Catálogo"
            rotulo="cursos abertos para inscrição"
            href="/cursos"
          />
        )}
      </section>
      )}
    </div>
  )
}

function Numero({
  Icon, valor, rotulo, href,
}: { Icon: typeof Clock; valor: string; rotulo: string; href: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-border bg-surface p-5 transition-colors hover:border-primary"
    >
      <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
      <p className="mt-2.5 font-display text-2xl font-semibold text-ink">{valor}</p>
      <p className="mt-0.5 text-sm text-muted">{rotulo}</p>
    </Link>
  )
}
