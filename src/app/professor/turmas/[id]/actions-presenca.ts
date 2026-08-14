'use server'

import { createClient } from '@/lib/supabase/server'

// Retorno de formato único: {ok, erro?}. Union type em server action passa no
// `next dev` e quebra no `next build` — seção 9 do ESTADO_DO_PROJETO.
export async function registrarPresenca(
  turmaId: string,
  presencas: { matricula: string; presente: boolean }[]
): Promise<{ ok: boolean; erro?: string }> {
  const supabase = await createClient()

  const { error } = await supabase.rpc('registrar_presenca', {
    p_turma: turmaId,
    p_presencas: presencas,
  })

  if (error) return { ok: false, erro: error.message }
  return { ok: true }
}
