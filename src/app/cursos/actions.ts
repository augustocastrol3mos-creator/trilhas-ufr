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
  // Volta para a página de onde veio (catálogo ou detalhe do curso), para o
  // aluno ler a recusa no contexto em que clicou.
  if (error) {
    const volta = String(formData.get('voltarPara') ?? '/cursos')
    const base = volta.startsWith('/cursos') ? volta : '/cursos'
    redirect(`${base}?erro=${encodeURIComponent(error.message)}`)
  }

  redirect(`/trilha/${data}`)
}
