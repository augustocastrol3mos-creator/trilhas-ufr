'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type Resposta = { ok: boolean; erro?: string }

export async function decidir(
  id: string, aprovar: boolean, resposta: string
): Promise<Resposta> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('decidir_solicitacao_nome', {
    p_solicitacao: id,
    p_aprovar: aprovar,
    p_resposta: resposta,
  })
  if (error) return { ok: false, erro: error.message }
  revalidatePath('/admin/solicitacoes')
  revalidatePath('/', 'layout')
  return { ok: true }
}
