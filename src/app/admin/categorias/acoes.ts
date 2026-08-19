'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// Formato único {ok, erro?} em todas: union type em server action passa no
// `next dev` e quebra no `next build` (seção 9 do ESTADO_DO_PROJETO).
type Resposta = { ok: boolean; erro?: string }

function revalidar() {
  revalidatePath('/admin/categorias')
  revalidatePath('/cursos')
}

export async function criarCategoria(nome: string, descricao: string): Promise<Resposta> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('criar_categoria', {
    p_nome: nome,
    p_descricao: descricao,
  })
  if (error) return { ok: false, erro: error.message }
  revalidar()
  return { ok: true }
}

export async function atualizarCategoria(
  id: string,
  dados: { nome: string; descricao: string; ordem?: number; ativa?: boolean }
): Promise<Resposta> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('atualizar_categoria', {
    p_categoria: id,
    p_dados: {
      nome: dados.nome,
      descricao: dados.descricao,
      ordem: dados.ordem != null ? String(dados.ordem) : '',
      ativa: dados.ativa,
    },
  })
  if (error) return { ok: false, erro: error.message }
  revalidar()
  return { ok: true }
}

export async function excluirCategoria(id: string): Promise<Resposta> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('excluir_categoria', { p_categoria: id })
  if (error) return { ok: false, erro: error.message }
  revalidar()
  return { ok: true }
}
