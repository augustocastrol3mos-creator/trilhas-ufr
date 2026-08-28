'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Formato único, campos opcionais. Union type em retorno de Server Action passa
 * no `next dev` e falha no `next build` (armadilha da seção 8).
 */
export type Resposta = {
  ok: boolean
  erro?: string
  respostaId?: string
}

/**
 * Grava UMA resposta e devolve o id da tentativa.
 *
 * POR QUE SALVAR A CADA ITEM, E NÃO TUDO NO FIM
 *
 * São 50+ frases. Se a gravação fosse só no botão final, fechar a aba na
 * questão 40 apagaria tudo — e quem perde 40 respostas não recomeça, desiste.
 * `iniciar_questionario()` devolve a tentativa em andamento se já existir, então
 * chamar de novo é seguro: ele não cria uma segunda.
 *
 * O `respostaId` volta para o cliente guardar e mandar nas chamadas seguintes,
 * economizando a ida ao `iniciar_questionario` a cada clique.
 */
export async function responder(
  itemId: string,
  valor: number,
  respostaId?: string
): Promise<Resposta> {
  const supabase = await createClient()

  let id = respostaId
  if (!id) {
    const { data, error } = await supabase.rpc('iniciar_questionario')
    if (error) {
      console.error('iniciar_questionario:', error.message)
      return { ok: false, erro: error.message }
    }
    id = data as string
  }

  const { error } = await supabase.rpc('responder_item', {
    p_resposta: id,
    p_item: itemId,
    p_valor: valor,
  })

  if (error) {
    console.error('responder_item:', error.message)
    return { ok: false, erro: error.message }
  }

  return { ok: true, respostaId: id }
}

export async function concluir(respostaId: string): Promise<Resposta> {
  const supabase = await createClient()

  const { error } = await supabase.rpc('concluir_questionario', { p_resposta: respostaId })
  if (error) {
    console.error('concluir_questionario:', error.message)
    return { ok: false, erro: error.message }
  }

  // O resultado aparece no perfil e na home; ambos precisam recarregar.
  revalidatePath('/', 'layout')
  return { ok: true }
}
