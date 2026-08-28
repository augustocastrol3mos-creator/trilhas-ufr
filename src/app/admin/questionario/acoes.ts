'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type Resposta = { ok: boolean; erro?: string; id?: string }

// Toda a autorização mora nas funções do banco (`e_admin()` por dentro de cada
// uma). Estas funções são transporte e não reimplementam regra — se
// reimplementassem, teríamos duas fontes de verdade divergindo com o tempo.

async function chamar(rpc: string, args: Record<string, unknown>): Promise<Resposta> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc(rpc, args)
  if (error) {
    console.error(`${rpc}:`, error.message)
    return { ok: false, erro: error.message }
  }
  revalidatePath('/admin/questionario')
  return { ok: true, id: typeof data === 'string' ? data : undefined }
}

export async function clonarVersao(titulo?: string) {
  return chamar('clonar_questionario', { p_titulo: titulo?.trim() || null })
}

export async function publicarVersao(id: string) {
  const r = await chamar('publicar_questionario', { p_questionario: id })
  // A versão ativa muda o que TODO aluno vê: o convite, a trava da inscrição e
  // o questionário em si. Revalidar o layout inteiro, não só esta tela.
  if (r.ok) revalidatePath('/', 'layout')
  return r
}

export async function excluirVersao(id: string) {
  return chamar('excluir_questionario', { p_questionario: id })
}

export async function salvarItem(
  questionarioId: string,
  competenciaId: string,
  enunciado: string,
  ordem: number,
  itemId?: string
) {
  return chamar('salvar_item_questionario', {
    p_item: itemId ?? null,
    p_questionario: questionarioId,
    p_competencia: competenciaId,
    p_enunciado: enunciado,
    p_ordem: ordem,
  })
}

export async function removerItem(itemId: string) {
  return chamar('remover_item_questionario', { p_item: itemId })
}

export async function moverItem(itemId: string, paraCima: boolean) {
  return chamar('reordenar_item_questionario', { p_item: itemId, p_para_cima: paraCima })
}

export async function liberarRefazer(usuarioId: string, motivo: string) {
  return chamar('liberar_refazer', { p_usuario: usuarioId, p_motivo: motivo })
}
