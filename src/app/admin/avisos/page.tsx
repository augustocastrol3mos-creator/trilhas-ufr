import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import GestorAvisos, { type AvisoAdmin } from './GestorAvisos'

export const dynamic = 'force-dynamic'

export default async function AvisosPage() {
  const supabase = await createClient()

  // A autorização mora na RPC (e_admin). Se recusar, a tela nem renderiza.
  const { data, error } = await supabase.rpc('avisos_todos')
  if (error) notFound()

  return (
    <div>
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" />
        Coordenação
      </Link>

      <h1 className="mt-4 font-display text-2xl font-semibold text-ink">Avisos</h1>
      <p className="mt-1 text-sm text-muted">
        Aparecem no topo de todas as telas de quem está logado. No máximo três por vez —
        além disso ninguém lê. Use a janela de datas para o aviso sumir sozinho quando
        deixar de valer.
      </p>

      <div className="mt-6">
        <GestorAvisos avisos={(data ?? []) as AvisoAdmin[]} />
      </div>
    </div>
  )
}
