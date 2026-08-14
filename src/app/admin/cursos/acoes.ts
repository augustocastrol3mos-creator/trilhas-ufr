'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// Formato de retorno único em todas ({ok, erro?}): union type em server action
// passa no `next dev` e quebra no `next build` — seção 9 do ESTADO_DO_PROJETO.
type Resposta = { ok: boolean; erro?: string }

export async function arquivarCurso(cursoId: string, motivo: string): Promise<Resposta> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('arquivar_curso', {
    p_curso: cursoId,
    p_motivo: motivo,
  })
  if (error) return { ok: false, erro: error.message }
  revalidatePath('/admin/cursos')
  revalidatePath('/cursos')
  return { ok: true }
}

export async function desarquivarCurso(cursoId: string): Promise<Resposta> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('desarquivar_curso', { p_curso: cursoId })
  if (error) return { ok: false, erro: error.message }
  revalidatePath('/admin/cursos')
  return { ok: true }
}

export async function excluirCurso(
  cursoId: string,
  confirmacao: string
): Promise<Resposta> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('excluir_curso', {
    p_curso: cursoId,
    p_confirmacao: confirmacao,
  })
  if (error) return { ok: false, erro: error.message }
  revalidatePath('/admin/cursos')
  revalidatePath('/cursos')
  return { ok: true }
}
