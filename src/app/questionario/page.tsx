import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ClipboardList } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { sessaoAtual } from '@/lib/auth'
import Questionario, { type Item } from './Questionario'

export const dynamic = 'force-dynamic'

type Payload = {
  existe: boolean
  questionario_id?: string
  titulo?: string
  descricao?: string
  resposta_id?: string | null
  total?: number
  itens?: Item[]
}

export default async function QuestionarioPage({
  searchParams,
}: {
  searchParams: Promise<{ refazer?: string }>
}) {
  const usuario = await sessaoAtual()
  if (!usuario) redirect('/login?proximo=/questionario')

  const { refazer } = await searchParams
  const supabase = await createClient()

  const [{ data, error }, { data: jaFez, error: erroFez }] = await Promise.all([
    supabase.rpc('questionario_ativo'),
    supabase.rpc('tem_autoavaliacao'),
  ])

  // Lição 4.9: nunca `const { data }` sozinho. Engolir erro de RPC já escondeu
  // três defeitos neste projeto.
  if (error) {
    console.error('questionario_ativo:', error.message)
    return (
      <div className="mx-auto max-w-xl rounded-lg border border-danger-soft bg-danger-soft/40 p-4 text-sm text-danger">
        Não consegui carregar a autoavaliação: {error.message}
      </div>
    )
  }
  if (erroFez) console.error('tem_autoavaliacao:', erroFez.message)

  const payload = (data ?? { existe: false }) as Payload

  if (!payload.existe) {
    return (
      <div className="mx-auto max-w-xl rounded-lg border border-border bg-surface p-6">
        <h1 className="font-display text-lg font-semibold text-ink">
          Autoavaliação ainda não disponível
        </h1>
        <p className="mt-2 text-sm text-muted">
          A coordenação ainda não publicou uma versão do questionário. Assim que publicar,
          ele aparece aqui.
        </p>
      </div>
    )
  }

  // Quem já concluiu vai para o resultado, a menos que peça para refazer
  // explicitamente. Sem isso, o link do menu levaria a pessoa a responder de
  // novo achando que estava só conferindo.
  if (jaFez && !refazer) redirect('/questionario/resultado')

  const itens = payload.itens ?? []

  return (
    <div>
      <div className="mx-auto max-w-xl">
        <div className="flex items-start gap-3">
          <ClipboardList className="mt-1 h-5 w-5 shrink-0 text-primary" />
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">{payload.titulo}</h1>
            <p className="mt-1.5 text-sm text-muted">{payload.descricao}</p>
          </div>
        </div>

        {/* O enquadramento importa mais do que parece: isto mede COMO A PESSOA
            SE PERCEBE, não a competência dela. Prometer medição de competência
            num instrumento de autorrelato é o que separa um diagnóstico
            defensável numa banca de um teste de revista. */}
        <p className="mt-4 rounded-md border border-border bg-canvas px-3 py-2.5 text-sm text-muted">
          Isto é uma autoavaliação: o retrato de como você se percebe hoje. Não vale nota,
          não aparece para mais ninguém sem que a coordenação decida, e você pode refazer
          depois para comparar.
        </p>

        {refazer && jaFez && (
          <p className="mt-3 rounded-md border border-accent-soft bg-accent-soft px-3 py-2.5 text-sm text-accent">
            Você está refazendo. O resultado anterior fica guardado — dá para comparar depois.{' '}
            <Link href="/questionario/resultado" className="underline underline-offset-2">
              Ver o resultado atual
            </Link>
          </p>
        )}
      </div>

      <div className="mt-8">
        <Questionario itens={itens} respostaId={payload.resposta_id ?? null} />
      </div>
    </div>
  )
}
