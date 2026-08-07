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

export async function reabrirTurma(turmaId: string, justificativa: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('reabrir_turma', {
    p_turma: turmaId,
    p_justificativa: justificativa,
  })
  if (error) return { erro: error.message }

  revalidatePath(`/professor/turmas/${turmaId}`, 'layout')
  return { ok: true }
}
