'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function inscrever(formData: FormData) {
  const turmaId = String(formData.get('turmaId'))
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?proximo=/cursos')

  const { data, error } = await supabase.rpc('inscrever', { p_turma: turmaId })
  if (error) throw new Error(error.message)

  redirect(`/trilha/${data}`)
}
