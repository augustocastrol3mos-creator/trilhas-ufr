'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function definirPapel(email: string, papel: 'aluno' | 'instrutor' | 'admin') {
  const supabase = await createClient()
  const { error } = await supabase.rpc('definir_papel', { p_email: email, p_papel: papel })
  if (error) return { erro: error.message }
  revalidatePath('/admin/usuarios')
  return { ok: true }
}

export async function autorizarPublicacao(cursoId: string, aprovar: boolean, motivo?: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('autorizar_publicacao', {
    p_curso: cursoId, p_aprovar: aprovar, p_motivo: motivo ?? null,
  })
  if (error) return { ok: false as const, erro: error.message }
  revalidatePath('/admin/cursos')
  revalidatePath('/cursos')
  return data as { ok: boolean; pendencias?: string[]; erro?: string }
}

export async function revogarCertificado(certificadoId: string, motivo: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('revogar_certificado', {
    p_certificado: certificadoId, p_motivo: motivo,
  })
  if (error) return { erro: error.message }
  revalidatePath('/admin/certificados')
  return { ok: true }
}

export async function reemitirCertificado(certificadoId: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('reemitir_certificado', {
    p_certificado_antigo: certificadoId,
  })
  if (error) return { erro: error.message }
  revalidatePath('/admin/certificados')
  return { ok: true }
}
