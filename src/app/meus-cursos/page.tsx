import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const STATUS: Record<string, { rotulo: string; classe: string }> = {
  inscrito: { rotulo: 'Inscrito', classe: 'border border-border-strong text-muted' },
  em_andamento: { rotulo: 'Em andamento', classe: 'bg-accent-soft text-accent' },
  trilha_concluida: { rotulo: 'Aguardando encontro', classe: 'bg-accent-soft text-accent' },
  aprovado: { rotulo: 'Aprovado', classe: 'bg-primary text-white' },
  reprovado: { rotulo: 'Reprovado', classe: 'bg-danger-soft text-danger' },
  certificado_emitido: { rotulo: 'Certificado emitido', classe: 'bg-primary text-white' },
}

export default async function MeusCursosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('matricula')
    .select('id, status, turma(identificador, curso(titulo, carga_horaria, modalidade))')
    .eq('usuario_id', user?.id ?? '')
    .order('criado_em', { ascending: false })

  if (error) {
    return (
      <div className="rounded-lg border border-danger-soft bg-danger-soft/40 p-4 text-sm text-danger">
        {error.message}
      </div>
    )
  }

  const matriculas = (data ?? []) as any[]

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink">Meus cursos</h1>
      </div>

      <ul className="mt-8 space-y-4">
        {matriculas.map((m) => (
          <li key={m.id} className="rounded-lg border border-border bg-surface p-5">
            <Link href={`/trilha/${m.id}`} className="text-lg font-medium hover:underline">
              {m.turma?.curso?.titulo}
            </Link>
            <p className="mt-1 text-sm text-muted">
              {STATUS[m.status]?.rotulo ?? m.status} · {m.turma?.curso?.carga_horaria}h
            </p>
          </li>
        ))}
      </ul>

      {matriculas.length === 0 && (
        <p className="mt-6 text-sm text-neutral-500">
          Você ainda não se inscreveu em nenhum curso.{' '}
          <Link href="/cursos" className="underline">Ver cursos disponíveis</Link>.
        </p>
      )}
    </div>
  )
}
