import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ROTULOS_TIPO } from '@/lib/blocos/defaults'
import EditorBloco from './EditorBloco'

export const dynamic = 'force-dynamic'

export default async function BlocoPage({
  params,
}: { params: Promise<{ id: string; blocoId: string }> }) {
  const { id, blocoId } = await params
  const supabase = await createClient()

  const { data: bloco } = await supabase
    .from('bloco')
    .select('id, tipo, titulo, config, obrigatorio, pontuavel, modulo(titulo)')
    .eq('id', blocoId)
    .single()

  if (!bloco) notFound()

  return (
    <div>
      <Link
        href={`/professor/cursos/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar ao curso
      </Link>

      <div className="mt-4 flex items-center gap-3">
        <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary-dark">
          {ROTULOS_TIPO[bloco.tipo as keyof typeof ROTULOS_TIPO]}
        </span>
        <span className="text-sm text-subtle">em {(bloco as any).modulo?.titulo}</span>
      </div>

      <h1 className="mt-2 font-display text-2xl font-semibold text-ink">{bloco.titulo}</h1>

      <EditorBloco cursoId={id} bloco={bloco as any} />
    </div>
  )
}
