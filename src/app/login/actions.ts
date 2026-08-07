'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function entrar(_estado: unknown, formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get('email')),
    password: String(formData.get('senha')),
  })
  if (error) return { erro: error.message }

  revalidatePath('/', 'layout')
  redirect(String(formData.get('proximo') || '/meus-cursos'))
}

export async function cadastrar(_estado: unknown, formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email: String(formData.get('email')),
    password: String(formData.get('senha')),
    options: {
      data: { nome_completo: String(formData.get('nome') || '') },
    },
  })
  if (error) return { erro: error.message }

  revalidatePath('/', 'layout')
  redirect('/cursos')
}

export async function sair() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}
