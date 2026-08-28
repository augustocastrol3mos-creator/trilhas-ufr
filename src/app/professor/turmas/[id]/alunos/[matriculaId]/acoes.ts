'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type Resposta = { ok: boolean; erro?: string }

/**
 * A autorização real mora em `registrar_veredito()`, no banco: ela checa
 * `e_instrutor_da_matricula()` e que a competência pertence ao curso. Esta
 * função é transporte — não reimplementa regra nenhuma, e não deve.
 */
export async function salvarVeredito(
  matriculaId: string,
  competenciaId: string,
  demonstrada: boolean
): Promise<Resposta> {
  const supabase = await createClient()

  const { error } = await supabase.rpc('registrar_veredito', {
    p_matricula: matriculaId,
    p_competencia: competenciaId,
    p_demonstrada: demonstrada,
  })

  if (error) {
    console.error('registrar_veredito:', error.message)
    return { ok: false, erro: error.message }
  }

  revalidatePath(`/professor/turmas`, 'layout')
  return { ok: true }
}
