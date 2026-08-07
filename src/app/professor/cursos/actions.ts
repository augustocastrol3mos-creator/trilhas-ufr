'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DEFAULTS_CONFIG } from '@/lib/blocos/defaults'
import type { TipoBloco } from '@/lib/blocos/schemas'

export async function criarCurso(formData: FormData) {
  const supabase = await createClient()
  const modalidade = String(formData.get('modalidade'))

  const { data, error } = await supabase.rpc('criar_curso', {
    p_dados: {
      titulo: String(formData.get('titulo') ?? ''),
      descricao: String(formData.get('descricao') ?? ''),
      cargaHoraria: Number(formData.get('cargaHoraria') ?? 20),
      modalidade,
      pesoOnline: Number(formData.get('pesoOnline') ?? 60),
      notaMinima: Number(formData.get('notaMinima') ?? 60),
      turma: String(formData.get('turma') ?? ''),
      encontroData: String(formData.get('encontroData') ?? '') || null,
      encontroLocal: String(formData.get('encontroLocal') ?? ''),
    },
  })

  if (error) throw new Error(error.message)
  revalidatePath('/professor/cursos')
  redirect(`/professor/cursos/${data}`)
}

export async function criarModulo(cursoId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: ultimo } = await supabase
    .from('modulo').select('ordem').eq('curso_id', cursoId)
    .order('ordem', { ascending: false }).limit(1).maybeSingle()

  const { error } = await supabase.from('modulo').insert({
    curso_id: cursoId,
    ordem: (ultimo?.ordem ?? 0) + 1,
    titulo: String(formData.get('titulo') ?? 'Novo módulo'),
    descricao: String(formData.get('descricao') ?? '') || null,
  })
  if (error) return { erro: error.message }

  revalidatePath(`/professor/cursos/${cursoId}`)
  return { ok: true }
}

export async function excluirModulo(cursoId: string, moduloId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('modulo').delete().eq('id', moduloId)
  if (error) return { erro: error.message }
  revalidatePath(`/professor/cursos/${cursoId}`)
  return { ok: true }
}

export async function criarBloco(cursoId: string, moduloId: string, tipo: TipoBloco) {
  const supabase = await createClient()
  const { data: ultimo } = await supabase
    .from('bloco').select('ordem').eq('modulo_id', moduloId)
    .order('ordem', { ascending: false }).limit(1).maybeSingle()

  const { data, error } = await supabase.from('bloco').insert({
    modulo_id: moduloId,
    ordem: (ultimo?.ordem ?? 0) + 1,
    tipo,
    titulo: DEFAULTS_CONFIG[tipo].titulo,
    config: DEFAULTS_CONFIG[tipo].config,
    obrigatorio: true,
    pontuavel: tipo === 'quiz',
  }).select('id').single()

  if (error) {
    // RLS negou: quase sempre o curso não tem você como autor
    if (error.message.includes('row-level security')) {
      return {
        erro: 'Você não é o autor deste curso, então não pode editá-lo. Se o curso foi criado por SQL, defina o autor_id.',
      }
    }
    return { erro: error.message }
  }

  redirect(`/professor/cursos/${cursoId}/blocos/${data.id}`)
}

export async function salvarBloco(
  cursoId: string, blocoId: string,
  dados: { titulo: string; config: unknown; obrigatorio: boolean; pontuavel: boolean }
) {
  const supabase = await createClient()
  const { error } = await supabase.from('bloco').update({
    titulo: dados.titulo,
    config: dados.config,
    obrigatorio: dados.obrigatorio,
    pontuavel: dados.pontuavel,
  }).eq('id', blocoId)

  if (error) return { erro: error.message }
  revalidatePath(`/professor/cursos/${cursoId}`)
  return { ok: true }
}

export async function excluirBloco(cursoId: string, blocoId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('bloco').delete().eq('id', blocoId)
  if (error) return { erro: error.message }
  revalidatePath(`/professor/cursos/${cursoId}`)
  return { ok: true }
}

export async function alternarPublicacao(cursoId: string, publicar: boolean) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('publicar_curso', {
    p_curso: cursoId,
    p_publicar: publicar,
  })
  if (error) return { erro: error.message }

  revalidatePath(`/professor/cursos/${cursoId}`)
  revalidatePath('/cursos')
  return data as { ok: boolean; status?: string; pendencias?: string[] }
}

export async function moverItem(
  cursoId: string, tipo: 'modulo' | 'bloco', id: string, direcao: number
) {
  const supabase = await createClient()
  const { error } = await supabase.rpc(tipo === 'modulo' ? 'mover_modulo' : 'mover_bloco', {
    [tipo === 'modulo' ? 'p_modulo' : 'p_bloco']: id,
    p_direcao: direcao,
  })
  if (error) return { erro: error.message }

  revalidatePath(`/professor/cursos/${cursoId}`)
  return { ok: true }
}
