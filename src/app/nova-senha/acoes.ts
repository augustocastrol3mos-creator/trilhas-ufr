'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type Resposta = { ok: boolean; erro?: string; aviso?: string }

/**
 * Grava a senha nova da pessoa que chegou pelo link de recuperação.
 *
 * A checagem de tamanho é repetida aqui de propósito, mesmo com `minLength` no
 * input: `minLength` é validação do NAVEGADOR, e quem manda um POST direto não
 * passa por ela. Validação de cliente serve para dar aviso rápido, nunca para
 * garantir invariante — o mesmo raciocínio que põe a regra de negócio no
 * Postgres em vez do React.
 *
 * O `updateUser` do Supabase não pede a senha antiga, e não deveria: quem chega
 * aqui provou o acesso ao e-mail, que é o que o fluxo de recuperação verifica.
 */
export async function definirSenha(_estado: unknown, formData: FormData): Promise<Resposta> {
  const senha = String(formData.get('senha') || '')
  const repetida = String(formData.get('repetida') || '')

  if (senha.length < 6) return { ok: false, erro: 'A senha precisa de ao menos 6 caracteres.' }
  if (senha !== repetida) return { ok: false, erro: 'As duas senhas não são iguais.' }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return {
      ok: false,
      erro: 'Sua sessão expirou. Peça um novo link de redefinição na tela de acesso.',
    }
  }

  const { error } = await supabase.auth.updateUser({ password: senha })
  if (error) {
    console.error('definirSenha updateUser:', error.message)
    // "New password should be different from the old password" é o caso comum
    // aqui: a pessoa lembrou da senha no meio do caminho e digitou a mesma.
    if (error.message.toLowerCase().includes('should be different')) {
      return { ok: false, erro: 'Essa já é a sua senha atual. Escolha uma diferente.' }
    }
    return { ok: false, erro: error.message }
  }

  /**
   * Derruba as OUTRAS sessões desta conta, mantendo a atual.
   *
   * Sem isto, trocar a senha não expulsa ninguém: se a conta foi acessada por
   * outra pessoa, ela continua logada no navegador dela com a sessão antiga —
   * e a troca de senha, que é justamente o que se faz quando isso acontece,
   * não teria resolvido nada. O `scope: 'others'` preserva a sessão de quem
   * acabou de trocar, então a pessoa não é deslogada da própria tela.
   */
  const { error: erroSaida } = await supabase.auth.signOut({ scope: 'others' })
  if (erroSaida) console.error('definirSenha signOut others:', erroSaida.message)

  revalidatePath('/', 'layout')
  return { ok: true, aviso: 'Senha alterada. Você já está conectado.' }
}
