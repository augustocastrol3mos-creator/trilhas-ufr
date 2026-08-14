'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function inscrever(formData: FormData) {
  const turmaId = String(formData.get('turmaId'))
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?proximo=/cursos')

  const { data, error } = await supabase.rpc('inscrever', { p_turma: turmaId })

  // A regra mora no banco (0013). Aqui só traduzimos a recusa em algo legível:
  // throw new Error derrubava a página inteira para o aluno que clicasse numa
  // turma lotada ou fora do prazo.
  if (error) {
    redirect(`/cursos?erro=${encodeURIComponent(error.message)}`)
  }

  redirect(`/trilha/${data}`)
}
