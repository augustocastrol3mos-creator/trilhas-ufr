import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { AlertTriangle, Award, BookOpen, Clock, GraduationCap } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { sessaoAtual } from '@/lib/auth'
import DadosPrivacidade, { type Solicitacao } from './DadosPrivacidade'
import ResumoCompetencias, { type Autoavaliacao, type Cursada } from '@/components/ResumoCompetencias'

export const dynamic = 'force-dynamic'

// Edição direta, válida só antes da primeira inscrição. Depois disso o gatilho
// do banco (0031) recusa, e o caminho passa a ser a solicitação.
async function salvar(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const user = await sessaoAtual()
  if (!user) return

  await supabase
    .from('usuario')
    .update({
      nome_completo: String(formData.get('nome') ?? '').trim(),
      e_estudante_ufr: formData.get('ufr') === 'on',
      rga: String(formData.get('rga') ?? '').trim() || null,
    })
    .eq('id', user.id)

  revalidatePath('/perfil')
  revalidatePath('/', 'layout')
}

export default async function PerfilPage() {
  const supabase = await createClient()
  const user = await sessaoAtual()

  const [
    { data: perfil },
    { data: percursoRaw },
    { data: solicitacaoRaw },
    { data: compsRaw },
    { data: autoRaw, error: erroAuto },
  ] = await Promise.all([
      supabase
        .from('usuario')
        .select('nome_completo, email, rga, e_estudante_ufr')
        .eq('id', user?.id ?? '')
        .single(),
      supabase.rpc('meu_percurso'),
      supabase.rpc('minha_solicitacao_dados'),
      supabase.rpc('minhas_competencias'),
      supabase.rpc('meu_perfil_competencias'),
    ])

  // Lição 4.9: erro engolido já escondeu três defeitos neste projeto.
  if (erroAuto) console.error('meu_perfil_competencias:', erroAuto.message)

  const p = (percursoRaw ?? {}) as {
    matriculas?: number
    emAndamento?: number
    concluidos?: number
    certificados?: number
    horas?: number
    porCategoria?: { nome: string; horas: number }[]
  }

  // A partir da primeira inscrição, nome e RGA determinam o que sai impresso
  // no certificado — deixam de ser autoatendimento. A regra real está no
  // gatilho do banco; aqui só antecipamos, para não dar erro ao salvar.
  const travado = (p.matriculas ?? 0) > 0

  const comps = (compsRaw ?? []) as Cursada[]
  const autoavaliacao = (autoRaw ?? []) as Autoavaliacao[]
  const vazio = !perfil?.nome_completo?.trim()

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-semibold text-ink">Perfil</h1>
      <p className="mt-1 text-sm text-muted">
        Seu percurso na plataforma e os dados que vão impressos no certificado.
      </p>

      {vazio && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-accent-soft bg-accent-soft p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <p className="text-ink">
            Preencha seu nome completo antes de concluir um curso. Sem ele, o certificado
            não pode ser emitido.
          </p>
        </div>
      )}

      {/* ---------- percurso ---------- */}
      <section aria-labelledby="percurso" className="mt-6">
        <div className="rounded-lg border border-border bg-surface p-6">
          <h2 id="percurso" className="text-xs font-semibold uppercase tracking-wide text-muted">
            Meu percurso
          </h2>

          <div className="mt-3 flex flex-wrap items-baseline gap-x-3">
            <span className="font-display text-4xl font-bold text-primary-dark">
              {p.horas ?? 0}h
            </span>
            <span className="text-sm text-muted">
              em atividades complementares com certificado
            </span>
          </div>
          <p className="mt-1.5 text-xs text-subtle">
            Só entram na conta os cursos com certificado emitido — é o documento que a
            coordenação aceita para integralização.
          </p>

          <dl className="mt-5 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-3">
            <Numero Icon={BookOpen} rotulo="Inscrições" valor={p.matriculas ?? 0} />
            <Numero Icon={GraduationCap} rotulo="Em andamento" valor={p.emAndamento ?? 0} />
            <Numero Icon={Award} rotulo="Certificados" valor={p.certificados ?? 0} />
          </dl>

          {(p.porCategoria ?? []).length > 0 && (
            <>
              <h3 className="mt-6 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                <Clock className="h-3.5 w-3.5" />
                Horas por categoria
              </h3>
              <ul className="mt-2.5 space-y-1.5">
                {(p.porCategoria ?? []).map((c) => (
                  <li key={c.nome} className="flex flex-wrap items-baseline justify-between gap-4 text-sm">
                    <span className="text-ink">{c.nome}</span>
                    <span className="shrink-0 font-medium text-muted">{c.horas}h</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="mt-6 flex flex-wrap gap-4 border-t border-border pt-4 text-sm font-medium">
            <Link href="/meus-cursos" className="text-primary hover:underline">
              Meus cursos
            </Link>
            <Link href="/certificados" className="text-primary hover:underline">
              Meus certificados
            </Link>
            <Link href="/cursos" className="text-primary hover:underline">
              Buscar novos cursos
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- competências ----------
          Logo abaixo do percurso e ANTES dos dados cadastrais: a gestão de
          competências é o eixo do projeto de extensão, e o que vem primeiro na
          tela é o que a pessoa entende como sendo o assunto. */}
      <div className="mt-6">
        <ResumoCompetencias autoavaliacao={autoavaliacao} cursadas={comps} />
      </div>

      {/* ---------- edição livre, antes da primeira inscrição ---------- */}
      {!travado && (
        <form action={salvar} className="mt-6 rounded-lg border border-border bg-surface p-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Dados do certificado
          </h2>
          <p className="mt-2 text-sm text-muted">
            Nome e RGA aparecem <strong className="text-ink">exatamente assim</strong> no
            certificado. Você pode editá-los livremente até a sua primeira inscrição;
            depois disso, correções passam pela coordenação.
          </p>

          <label className="mt-5 block text-sm font-medium text-ink">
            Nome completo
            <input
              name="nome"
              required
              defaultValue={perfil?.nome_completo ?? ''}
              className="mt-1.5 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-ink"
            />
          </label>
          <p className="mt-1.5 text-xs text-subtle">Escreva como consta no seu documento.</p>

          <div className="mt-5 rounded-md border border-border bg-canvas p-4">
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                name="ufr"
                defaultChecked={perfil?.e_estudante_ufr ?? false}
                className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]"
              />
              <span className="text-sm text-ink">Sou estudante da UFR</span>
            </label>

            <label className="mt-3 block text-sm font-medium text-ink">
              RGA
              <input
                name="rga"
                inputMode="numeric"
                pattern="[0-9]{12}"
                maxLength={12}
                placeholder="202300000000"
                defaultValue={perfil?.rga ?? ''}
                className="mt-1.5 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-ink"
              />
            </label>
            <p className="mt-1.5 text-xs text-subtle">
              12 dígitos, começando pelo ano de ingresso. É o que permite à coordenação
              conferir o certificado contra o registro acadêmico.
            </p>
          </div>

          <button className="mt-6 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark">
            Salvar
          </button>
        </form>
      )}

      {/* ---------- dados e privacidade ---------- */}
      <div className="mt-6">
        <DadosPrivacidade
          nome={perfil?.nome_completo ?? ''}
          rga={perfil?.rga ?? null}
          email={perfil?.email ?? ''}
          travado={travado}
          solicitacao={(solicitacaoRaw ?? null) as Solicitacao}
        />
      </div>
    </div>
  )
}

function Numero({
  Icon, rotulo, valor,
}: { Icon: typeof Award; rotulo: string; valor: number }) {
  return (
    <div className="bg-surface px-4 py-3">
      <dt className="flex items-center gap-1.5 text-xs text-muted">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {rotulo}
      </dt>
      <dd className="mt-0.5 font-display text-xl font-semibold text-ink">{valor}</dd>
    </div>
  )
}
