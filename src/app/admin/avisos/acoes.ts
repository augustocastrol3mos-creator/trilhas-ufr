'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type Resposta = { ok: boolean; erro?: string }

export type DadosAviso = {
  titulo: string
  mensagem: string
  tipo: string
  publico: string
  inicioEm: string
  fimEm: string
}

// revalidatePath('/', 'layout') porque o aviso é lido no layout e aparece em
// TODAS as páginas: revalidar só /admin/avisos deixaria o aviso novo invisível
// no resto do app até o cache expirar.
function revalidar() {
  revalidatePath('/', 'layout')
}

export async function criarAviso(dados: DadosAviso): Promise<Resposta> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('criar_aviso', { p_dados: dados })
  if (error) return { ok: false, erro: error.message }
  revalidar()
  return { ok: true }
}

export async function atualizarAviso(id: string, dados: DadosAviso): Promise<Resposta> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('atualizar_aviso', { p_aviso: id, p_dados: dados })
  if (error) return { ok: false, erro: error.message }
  revalidar()
  return { ok: true }
}

export async function excluirAviso(id: string): Promise<Resposta> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('excluir_aviso', { p_aviso: id })
  if (error) return { ok: false, erro: error.message }
  revalidar()
  return { ok: true }
}
