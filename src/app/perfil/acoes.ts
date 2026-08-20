'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type Resposta = { ok: boolean; erro?: string; aviso?: string }

export async function solicitarDados(
  nome: string, rga: string, motivo: string
): Promise<Resposta> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('solicitar_alteracao_dados', {
    p_nome: nome, p_rga: rga, p_motivo: motivo,
  })
  if (error) return { ok: false, erro: error.message }
  revalidatePath('/perfil')
  return { ok: true }
}

export async function cancelarSolicitacao(id: string): Promise<Resposta> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('cancelar_solicitacao_dados', { p_solicitacao: id })
  if (error) return { ok: false, erro: error.message }
  revalidatePath('/perfil')
  return { ok: true }
}

export async function trocarSenha(nova: string): Promise<Resposta> {
  if (nova.length < 6) return { ok: false, erro: 'a senha precisa de ao menos 6 caracteres' }
  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: nova })
  if (error) return { ok: false, erro: error.message }
  return { ok: true, aviso: 'Senha alterada.' }
}

export async function trocarEmail(novo: string): Promise<Resposta> {
  const supabase = await createClient()
  // O Supabase envia um link de confirmação para o novo endereço; a troca só
  // vale depois que a pessoa clica. Um gatilho no banco (0031) atualiza a cópia
  // em `usuario.email` quando isso acontece.
  const { error } = await supabase.auth.updateUser({ email: novo.trim() })
  if (error) return { ok: false, erro: error.message }
  return {
    ok: true,
    aviso: 'Enviamos um link de confirmação para o novo endereço. O e-mail só muda depois que você clicar nele.',
  }
}
