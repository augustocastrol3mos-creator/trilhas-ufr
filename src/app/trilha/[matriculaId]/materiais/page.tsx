import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, FolderOpen } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { sessaoAtual } from '@/lib/auth'
import ListaMateriais, { type ModuloMateriais } from './ListaMateriais'

export const dynamic = 'force-dynamic'

export default async function MateriaisPage({
  params,
}: { params: Promise<{ matriculaId: string }> }) {
  const { matriculaId } = await params
  const supabase = await createClient()

  const user = await sessaoAtual()
  if (!user) notFound()

  // Filtro explícito por dono, além do RLS — a política matricula_admin soma
  // por OR com matricula_propria (seção 3 do ESTADO_DO_PROJETO).
  const [{ data: matricula }, { data, error }] = await Promise.all([
    supabase
      .from('matricula')
      .select('id, turma(curso(titulo))')
      .eq('id', matriculaId)
      .eq('usuario_id', user.id)
      .single(),
    supabase.rpc('materiais_do_curso', { p_matricula: matriculaId }),
  ])

  if (!matricula || error) notFound()

  return (
    <div>
      <Link
        href={`/trilha/${matriculaId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar à trilha
      </Link>

      <h1 className="mt-4 flex items-center gap-2 font-display text-2xl font-semibold text-ink">
        <FolderOpen className="h-5 w-5 text-primary" aria-hidden="true" />
        Materiais do curso
      </h1>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        {(matricula as any).turma?.curso?.titulo} · os arquivos liberam junto com os
        módulos, e continuam aqui depois que você concluir o curso.
      </p>

      <div className="mt-6">
        <ListaMateriais modulos={(data ?? []) as ModuloMateriais[]} />
      </div>
    </div>
  )
}
