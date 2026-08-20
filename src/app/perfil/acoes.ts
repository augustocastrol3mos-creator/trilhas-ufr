'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type Resposta = { ok: boolean; erro?: string }

export async function solicitarNome(nome: string, motivo: string): Promise<Resposta> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('solicitar_alteracao_nome', {
    p_nome: nome,
    p_motivo: motivo,
  })
  if (error) return { ok: false, erro: error.message }
  revalidatePath('/perfil')
  return { ok: true }
}

export async function cancelarSolicitacao(id: string): Promise<Resposta> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('cancelar_solicitacao_nome', { p_solicitacao: id })
  if (error) return { ok: false, erro: error.message }
  revalidatePath('/perfil')
  return { ok: true }
}
