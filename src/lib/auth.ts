import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

export type Usuario = {
  id: string
  email: string
  nome: string
  papel: string
}

/**
 * Sessão do request, resolvida UMA vez por renderização.
 *
 * O problema que isto resolve: `supabase.auth.getUser()` não lê o cookie — ele
 * faz ida e volta na rede até o servidor de Auth do Supabase para validar o
 * token. O layout chamava uma vez, cada página chamava de novo, e o /perfil
 * chamava duas vezes no mesmo arquivo. Somando a consulta do papel, uma página
 * de aluno logado gastava 3 viagens de rede antes de consultar qualquer coisa
 * que ela de fato precisava.
 *
 * `cache()` do React memoriza o resultado durante UMA passada de renderização
 * no servidor. Layout, página e componentes aninhados compartilham a mesma
 * resposta; requisições diferentes não compartilham nada. É o mecanismo certo
 * aqui — `unstable_cache` ou `revalidate` seriam cache ENTRE requisições, e
 * cachear identidade entre requisições é como se vaza sessão de um usuário
 * para outro.
 *
 * O middleware continua com a chamada dele: roda em outro contexto (edge),
 * antes da renderização, e é ele que renova o token. Não dá para deduplicar
 * com esta — e não deveria.
 */
export const sessaoAtual = cache(async (): Promise<Usuario | null> => {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('usuario')
    .select('papel, nome_completo')
    .eq('id', user.id)
    .single()

  return {
    id: user.id,
    email: user.email ?? '',
    // a tabela é a fonte canônica; o metadata do Auth é só o fallback do
    // cadastro, e pode estar desatualizado se o aluno editou o perfil
    nome: data?.nome_completo || (user.user_metadata?.nome_completo as string) || '',
    papel: data?.papel ?? 'aluno',
  }
})
