import Link from 'next/link'
import { ArrowRight, Clock, ClipboardCheck, Route, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import FormularioAcesso from '@/components/FormularioAcesso'
import GrafismoHero from '@/components/GrafismoHero'
import { sessaoAtual } from '@/lib/auth'
import InicioAutenticado, { type Inicio, type Vitrine } from '@/components/InicioAutenticado'
import CapaCurso from '@/components/CapaCurso'

export const dynamic = 'force-dynamic'

export default async function Home({
  searchParams,
}: { searchParams: Promise<{ semAcesso?: string }> }) {
  const { semAcesso } = await searchParams
  const supabase = await createClient()
  const user = await sessaoAtual()

  const aviso = semAcesso ? (
    <p className="mx-auto mt-6 max-w-5xl rounded-lg border border-accent-soft bg-accent-soft px-4 py-3 text-sm text-ink">
      Aquela área é restrita à coordenação e aos professores. Se você deveria ter acesso,
      peça à coordenação para conceder o papel na sua conta.
    </p>
  ) : null

  if (user) {
    const [{ data: inicio, error: erroInicio }, { data: vitrine, error: erroVitrine }] =
      await Promise.all([
        supabase.rpc('meu_inicio'),
        supabase.rpc('vitrine_inicio'),
      ])

    // Engolir o erro da RPC faz a tela mostrar zeros em vez de avisar que algo
    // quebrou — foi o que escondeu o defeito dos avisos, e agora escondeu este.
    // Vai para os logs da Vercel sem derrubar a página.
    if (erroInicio) console.error('meu_inicio:', erroInicio.message)
    if (erroVitrine) console.error('vitrine_inicio:', erroVitrine.message)
    return (
      <>
      {aviso}
      <InicioAutenticado
        nome={user.nome}
        inicio={(inicio ?? {}) as Inicio}
        vitrine={(vitrine ?? {}) as Vitrine}
        falhou={Boolean(erroInicio)}
      />
      </>
    )
  }

  const { data: cursos } = await supabase
    .from('curso')
    .select('id, slug, titulo, descricao, carga_horaria, modalidade, capa_url, categoria(nome)')
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
                Atividades complementares · UFR
              </span>

              <h1 className="mt-6 max-w-2xl font-display text-3xl font-semibold leading-[1.15] text-white md:text-[2.75rem]">
                Horas complementares que valem, com certificado que se comprova
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-white/75">
                Cursos gratuitos criados por docentes da UFR, no seu ritmo, com certificado
                que qualquer pessoa confere por um código público.
              </p>

              <dl className="mt-10 flex flex-wrap gap-x-12 gap-y-6 border-t border-white/15 pt-8">
                <Numero valor="Gratuito" rotulo="Todos os cursos" />
                <Numero valor="No seu ritmo" rotulo="Sem horário fixo" />
                <Numero valor="Verificável" rotulo="Certificado com código" />
              </dl>
            </div>

            <div className="w-full shrink-0 lg:w-[360px]">
              <FormularioAcesso variante="cartao" />
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Cursos abertos ----------
          Subiu para logo depois do hero: é o que a maioria de quem chega aqui
          veio buscar, e um curso de verdade convence mais que qualquer
          parágrafo sobre a plataforma. */}
      {(cursos ?? []).length > 0 && (
        <section className="border-b border-border bg-surface">
          <div className="mx-auto max-w-6xl px-6 py-14">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="font-display text-2xl font-semibold text-ink">Cursos abertos agora</h2>
              <Link href="/cursos" className="shrink-0 text-sm font-medium text-primary hover:underline">
                Ver todos
              </Link>
            </div>

            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(cursos ?? []).map((c: any) => (
                <li key={c.id}>
                  <Link
                    href={`/cursos/${c.slug}`}
                    className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface transition-colors hover:border-primary"
                  >
                    <CapaCurso
                      titulo={c.titulo}
                      capaUrl={c.capa_url}
                      categoria={c.categoria?.nome ?? null}
                      className="h-28 w-full"
                    />
                    <div className="flex flex-1 flex-col p-5">
                      <p className="font-display font-semibold leading-snug text-ink">{c.titulo}</p>
                      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{c.descricao}</p>
                      <p className="mt-4 flex items-center gap-3 border-t border-border pt-3 text-xs text-muted">
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {c.carga_horaria} horas
                        </span>
                        <span>{c.modalidade === 'online' ? '100% online' : 'híbrido'}</span>
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ---------- O argumento, uma vez só ----------
          Antes eram duas seções seguidas defendendo a mesma tese — o
          certificado é verificável e significa alguma coisa. Foram fundidas:
          dizer duas vezes não convence o dobro, cansa. */}
      <section className="border-b border-border bg-canvas">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:gap-16">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">
                Por que aqui é diferente
              </p>
              <h2 className="mt-3 font-display text-2xl font-semibold leading-tight text-ink">
                Um certificado só vale se for possível checá-lo
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted">
                Comprovante de atividade complementar costuma ser um PDF que ninguém
                confere. Aqui cada documento carrega um código público: a coordenação do seu
                curso ou um empregador confirma a autenticidade em segundos, sem depender de
                você.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                E ele só é emitido quando a trilha foi percorrida, a avaliação foi feita e —
                nos cursos híbridos — a presença foi confirmada. É o que separa registrar
                horas de comprovar o que você aprendeu a fazer.
              </p>
            </div>

            <ul className="grid gap-px self-start overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
              <Pilar
                Icon={Route}
                titulo="Uma trilha, não uma pilha"
                texto="Cada curso é um caminho ordenado. O módulo seguinte abre quando o anterior é concluído."
              />
              <Pilar
                Icon={ClipboardCheck}
                titulo="Avaliação que vale"
                texto="Questionários ao longo do caminho e, em parte dos cursos, um encontro presencial que confirma o aprendizado."
              />
              <Pilar
                Icon={ShieldCheck}
                titulo="Comprovação independente"
                texto="Código público em cada documento. Quem recebe confere na origem, sem passar por você."
              />
            </ul>
          </div>
        </div>
      </section>

      {/* ---------- Como funciona, em três passos ---------- */}
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <h2 className="font-display text-2xl font-semibold text-ink">Como funciona</h2>

          <ol className="relative mt-8 grid gap-10 sm:grid-cols-3">
            <span
              aria-hidden="true"
              className="absolute left-0 right-0 top-[18px] hidden border-t border-dashed border-border-strong sm:block"
            />
            <Passo n={1} titulo="Percorra a trilha">
              Vídeos, textos e materiais em módulos, no seu horário e quantas vezes precisar.
            </Passo>
            <Passo n={2} titulo="Seja avaliado">
              Questionários corrigidos na hora. Em cursos com turma, há também avaliação
              presencial com o professor.
            </Passo>
            <Passo n={3} titulo="Receba o certificado">
              Com carga horária, período e nota, mais um código e QR code para conferência.
            </Passo>
          </ol>

          <p className="mt-8 text-sm leading-relaxed text-muted">
            Cursos <strong className="text-ink">100% online</strong> têm inscrição sempre
            aberta e certificado emitido automaticamente ao concluir a trilha. Cursos{' '}
            <strong className="text-ink">híbridos</strong> têm turma, prazo e um encontro
            presencial na UFR, onde o professor confirma a presença antes da emissão.
          </p>
        </div>
      </section>

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


/** Home de quem já está autenticado: atalhos, sem discurso de apresentação. */
