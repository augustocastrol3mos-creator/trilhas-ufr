import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { AlertTriangle, Award, BookOpen, Clock, GraduationCap } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { sessaoAtual } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function salvar(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const user = await sessaoAtual()
  if (!user) return

  await supabase
    .from('usuario')
    .update({ nome_completo: String(formData.get('nome') ?? '').trim() })
    .eq('id', user.id)

  revalidatePath('/perfil')
  revalidatePath('/', 'layout')
}

export default async function PerfilPage() {
  const supabase = await createClient()
  const user = await sessaoAtual()
  // Independentes: vão juntas. O filtro por dono do percurso mora dentro da
  // RPC, não aqui — é o padrão que evita o vazamento da seção 3 do documento.
  const [{ data: perfil }, { data: percursoRaw }] = await Promise.all([
    supabase.from('usuario').select('nome_completo, email').eq('id', user?.id ?? '').single(),
    supabase.rpc('meu_percurso'),
  ])

  const p = (percursoRaw ?? {}) as {
    matriculas?: number
    emAndamento?: number
    concluidos?: number
    certificados?: number
    horas?: number
    porCategoria?: { nome: string; horas: number }[]
  }

  const vazio = !perfil?.nome_completo?.trim()

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-semibold text-ink">Perfil</h1>
      <p className="mt-1 text-sm text-muted">
        Este nome aparece exatamente assim no certificado.
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

      <section aria-labelledby="percurso" className="mt-6">
        <h2 id="percurso" className="sr-only">Meu percurso</h2>

        <div className="rounded-lg border border-border bg-surface p-6">
          <div className="flex flex-wrap items-baseline gap-x-3">
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

          <dl className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-border bg-border">
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
                  <li key={c.nome} className="flex items-baseline justify-between gap-4 text-sm">
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

      <form action={salvar} className="mt-6 rounded-lg border border-border bg-surface p-6">
        <label className="block text-sm font-medium text-ink">
          Nome completo
          <input
            name="nome"
            required
            defaultValue={perfil?.nome_completo ?? ''}
            className="mt-1.5 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-ink"
          />
        </label>
        <p className="mt-1.5 text-xs text-subtle">
          Escreva como consta no seu documento. Corrigir depois da emissão exige revogar e reemitir.
        </p>

        <label className="mt-5 block text-sm font-medium text-ink">
          E-mail
          <input
            disabled
            value={perfil?.email ?? ''}
            className="mt-1.5 w-full rounded-md border border-border bg-canvas px-3 py-2 text-sm text-muted"
          />
        </label>

        <button className="mt-6 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark">
          Salvar
        </button>
      </form>
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
