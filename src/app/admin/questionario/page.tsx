import Link from 'next/link'
import { ArrowLeft, TriangleAlert } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirAdmin } from '@/lib/auth'
import GestaoQuestionario from './GestaoQuestionario'
import LiberarRefazer, { type Aluno } from './LiberarRefazer'
import type { Versao } from './PainelVersoes'
import type { Item, Competencia } from './EditorItens'

export const dynamic = 'force-dynamic'

type Cobertura = { competencia_id: string; nome: string; cursos_publicados: number }

export default async function QuestionarioAdminPage() {
  await exigirAdmin()
  const supabase = await createClient()

  const [
    { data: versoesRaw, error: erroVersoes },
    { data: compsRaw, error: erroComps },
    { data: alunosRaw, error: erroAlunos },
    { data: covRaw },
  ] = await Promise.all([
    supabase.rpc('versoes_questionario'),
    supabase.rpc('competencias_com_uso'),
    supabase.rpc('alunos_autoavaliacao'),
    supabase.rpc('cobertura_competencias'),
  ])

  // Lição 4.9: erro engolido já escondeu três defeitos neste projeto.
  if (erroVersoes) console.error('versoes_questionario:', erroVersoes.message)
  if (erroComps) console.error('competencias_com_uso:', erroComps.message)
  if (erroAlunos) console.error('alunos_autoavaliacao:', erroAlunos.message)

  if (erroVersoes) {
    return (
      <div className="rounded-lg border border-danger-soft bg-danger-soft/40 p-4 text-sm text-danger">
        {erroVersoes.message}
      </div>
    )
  }

  const versoes = (versoesRaw ?? []) as Versao[]
  const competencias = ((compsRaw ?? []) as { id: string; numero: number; nome: string }[])
    .map((c) => ({ id: c.id, numero: c.numero, nome: c.nome })) as Competencia[]
  const alunos = (alunosRaw ?? []) as Aluno[]
  const cobertura = (covRaw ?? []) as Cobertura[]

  // Os itens de todas as versões numa consulta por versão. São poucas versões,
  // e carregar tudo aqui deixa a troca no cliente instantânea.
  const itensPorVersao: Record<string, Item[]> = {}
  await Promise.all(
    versoes.map(async (v) => {
      const { data, error } = await supabase.rpc('itens_questionario', { p_questionario: v.id })
      if (error) console.error('itens_questionario:', error.message)
      itensPorVersao[v.id] = (data ?? []) as Item[]
    })
  )

  const semCurso = cobertura.filter((c) => c.cursos_publicados === 0)

  return (
    <div>
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" />
        Coordenação
      </Link>

      <h1 className="mt-4 font-display text-2xl font-semibold text-ink">
        Autoavaliação de competências
      </h1>
      <p className="mt-1 text-sm text-muted">
        As frases que o aluno responde, e a competência de cada uma. A versão em uso é
        somente leitura: para mudar, crie uma nova a partir dela.
      </p>

      {/* A recomendação de cursos vale o que o catálogo tiver. Sem curso ligado a
          uma competência, o aluno que se avaliar baixo nela recebe uma tela sem
          sugestão nenhuma — e conclui que a plataforma não funciona. Este aviso
          é o que transforma isso num item de trabalho da coordenação em vez de
          uma reclamação de aluno. */}
      {semCurso.length > 0 && (
        <div className="mt-6 rounded-lg border border-accent-soft bg-accent-soft p-4">
          <p className="flex items-start gap-2 text-sm text-accent">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <span className="font-medium">
                {semCurso.length} de {cobertura.length} competências não têm nenhum curso
                publicado.
              </span>{' '}
              Quem se avaliar baixo nelas não vai receber sugestão nenhuma. Ligar cursos a
              competências se faz na edição de cada curso.
            </span>
          </p>
          <p className="mt-2 text-xs text-accent">{semCurso.map((c) => c.nome).join(' · ')}</p>
        </div>
      )}

      <GestaoQuestionario
        versoes={versoes}
        itensPorVersao={itensPorVersao}
        competencias={competencias}
      />

      <LiberarRefazer alunos={alunos} />
    </div>
  )
}
