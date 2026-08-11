'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function concluirBloco(
  matriculaId: string,
  blocoId: string,
  dados: Record<string, unknown> = {}
) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('concluir_bloco', {
    p_matricula: matriculaId,
    p_bloco: blocoId,
    p_dados: dados,
  })
  if (error) return { erro: error.message }

  revalidatePath(`/trilha/${matriculaId}`, 'layout')
  return { ok: true }
}

export async function registrarProgressoVideo(
  matriculaId: string,
  blocoId: string,
  percentual: number
) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('registrar_progresso_video', {
    p_matricula: matriculaId,
    p_bloco: blocoId,
    p_percentual: percentual,
  })
  if (error) return { erro: error.message }

  if (data?.concluido) revalidatePath(`/trilha/${matriculaId}`, 'layout')
  return { ok: true, ...data }
}

export async function submeterQuiz(
  matriculaId: string,
  blocoId: string,
  respostas: Record<string, unknown>
) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('submeter_quiz', {
    p_matricula: matriculaId,
    p_bloco: blocoId,
    p_respostas: respostas,
  })
  if (error) return { erro: error.message }

  revalidatePath(`/trilha/${matriculaId}`, 'layout')
  return { ok: true, ...data }
}

export async function urlDoMaterial(path: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.storage
    .from('materiais')
    .createSignedUrl(path, 60 * 10)

  if (error) return { erro: error.message }
  return { url: data.signedUrl }
}
