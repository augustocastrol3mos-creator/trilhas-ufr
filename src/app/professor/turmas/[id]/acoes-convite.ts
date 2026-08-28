'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type Resultado = {
  matriculados: string[]
  sem_conta: string[]
  ja_estavam: string[]
}

type Resposta = { ok: boolean; erro?: string; resultado?: Resultado }

export async function matricularPorEmail(
  turmaId: string,
  emails: string[]
): Promise<Resposta> {
  if (emails.length === 0) return { ok: false, erro: 'Nenhum e-mail informado.' }

  const supabase = await createClient()

  const { data, error } = await supabase.rpc('matricular_por_email', {
    p_turma: turmaId,
    p_emails: emails,
  })

  if (error) {
    console.error('matricular_por_email:', error.message)
    return { ok: false, erro: error.message }
  }

  revalidatePath(`/professor/turmas/${turmaId}`)
  return { ok: true, resultado: data as Resultado }
}
