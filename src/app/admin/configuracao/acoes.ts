'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type DadosConfig = {
  instituicaoNome: string
  instituicaoSigla: string
  orgaoEmissor: string
  assinanteNome: string
  assinanteCargo: string
  urlBase: string
  urlAcFacil: string
  rotuloAcFacil: string
}

export async function salvarConfiguracao(
  dados: DadosConfig
): Promise<{ ok: boolean; erro?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('atualizar_configuracao', { p_dados: dados })
  if (error) return { ok: false, erro: error.message }

  // A configuração aparece no certificado, na validação pública e na tela de
  // certificados (AC Fácil). Revalidar o layout inteiro é mais barato do que
  // esquecer uma rota e deixar dado velho em produção.
  revalidatePath('/', 'layout')
  return { ok: true }
}
