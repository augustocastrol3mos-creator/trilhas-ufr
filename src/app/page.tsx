import Link from 'next/link'
import { ArrowRight, Award, Clock, MapPin, Route, ShieldCheck, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import AcessoHero from '@/components/AcessoHero'
import GrafismoHero from '@/components/GrafismoHero'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) return <HomeAutenticada />

  const { data: cursos } = await supabase
    .from('curso')
    .select('id, slug, titulo, descricao, carga_horaria, modalidade')
    .eq('status', 'publicado')
    .order('titulo')
    .limit(3)

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden bg-primary-dark">
        <GrafismoHero />

        <div className="relative mx-auto max-w-6xl px-6 py-16 lg:py-20">
          <div className="flex flex-col gap-12 lg:flex-row lg:items-start lg:gap-16">
            <div className="min-w-0 flex-1">
              <span className="inline-block rounded-full border border-white/25 px-3 py-1 text-xs font-medium text-white/80">
                Extensão universitária · UFR
              </span>

              <h1 className="mt-6 max-w-2xl font-display text-3xl font-semibold leading-[1.15] text-white md:text-[2.75rem]">
                O conhecimento produzido na universidade, aberto a quem está fora dela
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-white/75">
                Cursos de extensão criados por docentes da UFR e por convidados. Você percorre
                a trilha no seu ritmo, é avaliado de verdade e recebe um certificado com
                validação pública.
              </p>

              <dl className="mt-10 flex flex-wrap gap-x-12 gap-y-6 border-t border-white/15 pt-8">
                <Numero valor="Gratuito" rotulo="Todos os cursos" />
                <Numero valor="No seu ritmo" rotulo="Sem horário fixo" />
                <Numero valor="Verificável" rotulo="Certificado com código" />
              </dl>
            </div>

            <div className="w-full shrink-0 lg:w-[360px]">
              <AcessoHero />
            </div>
          </div>
        </div>
      </section>

      {/* ---------- O que é extensão ---------- */}
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-16">
            <div>
              <h2 className="font-display text-2xl font-semibold leading-tight text-ink">
                Extensão é a universidade devolvendo o que produz
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted">
                Ensino, pesquisa e extensão sustentam a universidade pública. A extensão é a
                perna que atravessa o muro do campus: leva o que se investiga aqui dentro para
                quem trabalha, empreende e decide lá fora.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Esta plataforma existe para que esse caminho não dependa de sala física,
                horário fixo nem distância até Rondonópolis.
              </p>
            </div>

            <ul className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
              <Pilar
                Icon={Route}
                titulo="Uma trilha, não uma pilha"
                texto="Cada curso é um caminho ordenado. O módulo seguinte abre quando o anterior é concluído — você sempre sabe onde parou."
              />
              <Pilar
                Icon={Users}
                titulo="Quem ensina é quem pesquisa"
                texto="Os cursos nascem do que professores da UFR e profissionais convidados investigam e praticam."
              />
              <Pilar
                Icon={Award}
                titulo="Avaliação que vale"
                texto="Questionários ao longo da trilha e, em parte dos cursos, um encontro presencial que confirma o aprendizado."
              />
              <Pilar
                Icon={ShieldCheck}
                titulo="Certificado que se verifica"
                texto="Cada documento carrega um código público. Qualquer pessoa confere a autenticidade sem depender de você."
              />
            </ul>
          </div>
        </div>
      </section>

      {/* ---------- Como funciona ---------- */}
      <section className="border-b border-border bg-canvas">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="font-display text-2xl font-semibold text-ink">Como funciona</h2>

          <ol className="relative mt-10 grid gap-10 sm:grid-cols-3">
            <span
              aria-hidden="true"
              className="absolute left-0 right-0 top-[18px] hidden border-t border-dashed border-border-strong sm:block"
            />
            <Passo n={1} titulo="Percorra a trilha">
              Vídeos, textos e materiais organizados em módulos. Avança quando concluir o que é
              obrigatório, no seu horário e quantas vezes precisar.
            </Passo>
            <Passo n={2} titulo="Seja avaliado">
              Questionários corrigidos na hora ao longo do caminho. Em cursos com turma, a
              avaliação final acontece presencialmente com o professor.
            </Passo>
            <Passo n={3} titulo="Receba o certificado">
              Com carga horária, período e nota final, mais um código e QR code para
              conferência por qualquer pessoa.
            </Passo>
          </ol>

          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            <Modalidade
              titulo="Cursos permanentes"
              etiqueta="100% online"
              texto="Inscrição sempre aberta, sem turma nem data. Ao concluir a trilha com a nota mínima, o certificado é emitido automaticamente."
              destaque
            />
            <Modalidade
              titulo="Cursos com turma"
              etiqueta="híbrido"
              texto="A parte online prepara para um encontro presencial na UFR. O professor confirma a presença e decide a aprovação antes da emissão."
            />
          </div>
        </div>
      </section>

      {/* ---------- Cursos abertos ---------- */}
      {(cursos ?? []).length > 0 && (
        <section className="border-b border-border bg-surface">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <div className="flex items-end justify-between gap-4">
              <h2 className="font-display text-2xl font-semibold text-ink">Cursos abertos agora</h2>
              <Link href="/cursos" className="shrink-0 text-sm font-medium text-primary hover:underline">
                Ver todos
              </Link>
            </div>

            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(cursos ?? []).map((c) => (
                <li
                  key={c.id}
                  className="flex flex-col rounded-lg border border-border bg-surface p-5 transition-colors hover:border-primary"
                >
                  <span
                    className={`self-start rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      c.modalidade === 'online'
                        ? 'bg-primary-soft text-primary-dark'
                        : 'border border-border-strong text-muted'
                    }`}
                  >
                    {c.modalidade === 'online' ? '100% online' : 'híbrido'}
                  </span>
                  <p className="mt-3 font-display font-semibold leading-snug text-ink">{c.titulo}</p>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{c.descricao}</p>
                  <p className="mt-4 flex items-center gap-1.5 border-t border-border pt-3 text-xs text-subtle">
                    <Clock className="h-3.5 w-3.5" />
                    {c.carga_horaria} horas
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ---------- Validação ---------- */}
      <section className="bg-canvas">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="flex flex-wrap items-center justify-between gap-6 rounded-lg border border-border bg-surface p-6">
            <div className="flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </span>
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">
                  Recebeu um certificado e quer conferir?
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Informe o código impresso no documento. Não precisa de conta.
                </p>
              </div>
            </div>
            <Link
              href="/validar"
              className="inline-flex shrink-0 items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark"
            >
              Validar certificado
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}

function Numero({ valor, rotulo }: { valor: string; rotulo: string }) {
  return (
    <div>
      <dt className="font-display text-lg font-semibold text-white">{valor}</dt>
      <dd className="mt-0.5 text-xs text-white/60">{rotulo}</dd>
    </div>
  )
}

function Pilar({ Icon, titulo, texto }: { Icon: typeof Route; titulo: string; texto: string }) {
  return (
    <li className="bg-surface p-6">
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-3 font-display font-semibold text-ink">{titulo}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{texto}</p>
    </li>
  )
}

function Passo({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <li className="relative">
      <span className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-primary font-display text-sm font-semibold text-white ring-4 ring-canvas">
        {n}
      </span>
      <p className="mt-4 font-display font-semibold text-ink">{titulo}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{children}</p>
    </li>
  )
}

function Modalidade({
  titulo, etiqueta, texto, destaque,
}: { titulo: string; etiqueta: string; texto: string; destaque?: boolean }) {
  return (
    <div className={`rounded-lg border bg-surface p-5 ${destaque ? 'border-primary' : 'border-border'}`}>
      <div className="flex items-center gap-2">
        <p className="font-display font-semibold text-ink">{titulo}</p>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            destaque ? 'bg-primary-soft text-primary-dark' : 'border border-border-strong text-muted'
          }`}
        >
          {etiqueta}
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted">{texto}</p>
    </div>
  )
}

/** Home de quem já está autenticado: atalhos, sem discurso de apresentação. */
function HomeAutenticada() {
  return (
    <div>
      <div className="rounded-lg border border-border bg-surface p-8">
        <span className="inline-block rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary-dark">
          Extensão universitária
        </span>
        <h1 className="mt-4 font-display text-2xl font-semibold text-ink md:text-3xl">
          Continue de onde parou
        </h1>
        <p className="mt-3 max-w-xl text-muted">
          Suas trilhas em andamento, os cursos abertos e os certificados já emitidos.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/meus-cursos"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark"
          >
            Minhas trilhas
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/cursos"
            className="inline-flex items-center gap-2 rounded-md border border-border-strong px-4 py-2.5 text-sm font-medium text-ink hover:border-primary"
          >
            Ver catálogo
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Atalho href="/cursos" Icon={MapPin} titulo="Catálogo" texto="Cursos abertos para inscrição." />
        <Atalho href="/certificados" Icon={Award} titulo="Certificados" texto="Emitidos e prontos para baixar." />
        <Atalho href="/validar" Icon={ShieldCheck} titulo="Validar" texto="Conferir um certificado por código." />
      </div>
    </div>
  )
}

function Atalho({
  href, Icon, titulo, texto,
}: { href: string; Icon: typeof Route; titulo: string; texto: string }) {
  return (
    <Link href={href} className="rounded-lg border border-border bg-surface p-5 hover:border-border-strong">
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-3 text-sm font-medium text-ink">{titulo}</p>
      <p className="mt-1 text-sm text-muted">{texto}</p>
    </Link>
  )
}
