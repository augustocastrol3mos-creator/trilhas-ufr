'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type Decisao = {
  matriculaId: string
  presenca: boolean
  notaPresencial: string
  decisao: 'aprovado' | 'reprovado'
  justificativa: string
}

export async function fecharTurma(turmaId: string, decisoes: Decisao[]) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('fechar_turma', {
    p_turma: turmaId,
    p_decisoes: decisoes,
  })
  if (error) return { erro: error.message }

  revalidatePath('/professor', 'layout')
  revalidatePath('/meus-cursos')
  return { ok: true, ...data }
}
