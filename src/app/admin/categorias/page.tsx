import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import GestorCategorias, { type Categoria } from './GestorCategorias'

export const dynamic = 'force-dynamic'

export default async function CategoriasPage() {
  const supabase = await createClient()

  // A autorização mora na RPC (e_admin). Se recusar, a tela nem renderiza.
  const { data, error } = await supabase.rpc('categorias_com_uso')
  if (error) notFound()

  return (
    <div>
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Coordenação
      </Link>

      <h1 className="mt-4 font-display text-2xl font-semibold text-ink">Categorias</h1>
      <p className="mt-1 text-sm text-muted">
        O professor escolhe uma ao criar o curso e o aluno filtra por elas no catálogo.
        Categoria em uso não pode ser excluída — desative para tirá-la de circulação
        sem perder o rótulo dos cursos que já a têm.
      </p>

      <div className="mt-6">
        <GestorCategorias categorias={(data ?? []) as Categoria[]} />
      </div>
    </div>
  )
}
