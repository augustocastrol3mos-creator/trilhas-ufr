'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// A autorização é do RLS: a policy de escrita em `curso` só deixa o autor (ou
// a coordenação) alterar. Não reimplementamos a regra aqui.
export async function salvarCapa(
  cursoId: string, url: string | null
): Promise<{ ok: boolean; erro?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('curso').update({ capa_url: url }).eq('id', cursoId)
  if (error) return { ok: false, erro: error.message }

  revalidatePath(`/professor/cursos/${cursoId}`)
  revalidatePath('/cursos')
  revalidatePath('/')
  return { ok: true }
}
