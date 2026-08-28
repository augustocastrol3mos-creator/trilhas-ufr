'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type Resposta = { ok: boolean; erro?: string }

export async function definirVisibilidade(cursoId: string, visibilidade: string): Promise<Resposta> {
  const supabase = await createClient()

  const { error } = await supabase.rpc('definir_visibilidade_curso', {
    p_curso: cursoId,
    p_visibilidade: visibilidade,
  })

  if (error) {
    console.error('definir_visibilidade_curso:', error.message)
    return { ok: false, erro: error.message }
  }

  // Muda quem enxerga o curso: catálogo, home e a própria tela do curso.
  revalidatePath('/', 'layout')
  return { ok: true }
}
