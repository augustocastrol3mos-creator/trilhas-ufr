'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// Formato de retorno único ({ok, erro?}) em todas: union type em server action
// passa no `next dev` e quebra no `next build` — seção 9 do ESTADO_DO_PROJETO.
type Resposta = { ok: boolean; erro?: string }

export async function criarEncontro(
  turmaId: string,
  dados: { titulo: string; data: string; local: string }
): Promise<Resposta> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('criar_encontro', {
    p_turma: turmaId,
    p_dados: dados,
  })
  if (error) return { ok: false, erro: error.message }
  revalidatePath(`/professor/turmas/${turmaId}/encontros`)
  return { ok: true }
}

export async function removerEncontro(
  turmaId: string,
  encontroId: string
): Promise<Resposta> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('remover_encontro', { p_encontro: encontroId })
  if (error) return { ok: false, erro: error.message }
  revalidatePath(`/professor/turmas/${turmaId}/encontros`)
  return { ok: true }
}

export async function salvarChamada(
  turmaId: string,
  encontroId: string,
  presencas: { matricula: string; presente: boolean }[]
): Promise<Resposta> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('registrar_chamada', {
    p_encontro: encontroId,
    p_presencas: presencas,
  })
  if (error) return { ok: false, erro: error.message }
  revalidatePath(`/professor/turmas/${turmaId}/encontros`)
  return { ok: true }
}
