'use server'

import { verificarCredencial, chavePublicaJwk, type Resultado } from '@/lib/credencial'

export async function verificarArquivo(conteudo: string): Promise<Resultado> {
  let doc: unknown
  try {
    doc = JSON.parse(conteudo)
  } catch {
    return { assinaturaValida: false, motivo: 'O arquivo não é um JSON válido.' }
  }

  const jwk = chavePublicaJwk()
  if (!jwk) {
    return {
      assinaturaValida: false,
      motivo:
        'Este servidor não tem chave de assinatura configurada, então não consegue verificar nada.',
    }
  }

  return verificarCredencial(doc, jwk)
}
