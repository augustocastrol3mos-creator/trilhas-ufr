'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { enderecoBase } from '@/lib/url'

/**
 * Formato único de retorno, com todos os campos opcionais.
 *
 * A tentação aqui é um union: `{erro: string} | {aviso: string}`. Não faça —
 * union em retorno de Server Action passa no `next dev` e falha no `next build`
 * (armadilha da seção 8 do ESTADO_DO_PROJETO). Um tipo só, campos opcionais.
 */
export type Resposta = {
  ok: boolean
  erro?: string
  aviso?: string
  naoConfirmado?: boolean
}

/**
 * O Supabase responde em inglês e em linguagem de sistema. Quem lê é um aluno
 * às 23h tentando pegar o certificado — e cada mensagem que ele não entende
 * vira uma mensagem para a coordenação.
 */
function traduzir(mensagem: string): string {
  const m = mensagem.toLowerCase()
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (m.includes('email not confirmed')) return 'Você ainda não confirmou seu e-mail.'
  if (m.includes('user already registered')) return 'Já existe uma conta com esse e-mail. Use "Entrar", ou "Esqueci minha senha" se não lembrar dela.'
  if (m.includes('password should be at least')) return 'A senha precisa de ao menos 6 caracteres.'
  if (m.includes('rate limit') || m.includes('too many requests')) return 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.'
  if (m.includes('unable to validate email')) return 'Esse endereço de e-mail não parece válido.'
  return mensagem
}

export async function entrar(_estado: unknown, formData: FormData): Promise<Resposta> {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get('email')),
    password: String(formData.get('senha')),
  })

  if (error) {
    // Quando a confirmação de e-mail estiver religada, este passa a ser um erro
    // COMUM, não excepcional: a pessoa se cadastrou, não viu o e-mail, e tenta
    // entrar. Marcar o caso permite à tela oferecer o reenvio ali mesmo — sem
    // isso, quem administra vira o serviço de reenvio de todo mundo, que é
    // exatamente o problema que este lote existe para evitar.
    const naoConfirmado = error.message.toLowerCase().includes('email not confirmed')
    return { ok: false, erro: traduzir(error.message), naoConfirmado }
  }

  revalidatePath('/', 'layout')
  redirect(String(formData.get('proximo') || '/meus-cursos'))
}

export async function cadastrar(_estado: unknown, formData: FormData): Promise<Resposta> {
  const supabase = await createClient()
  const base = await enderecoBase()

  const { data, error } = await supabase.auth.signUp({
    email: String(formData.get('email')),
    password: String(formData.get('senha')),
    options: {
      // Sem isto, o link de confirmação usa o Site URL configurado no painel do
      // Supabase — que hoje é a raiz do site, onde nada trata o código.
      emailRedirectTo: `${base}/auth/callback?proximo=/meus-cursos`,
      data: {
        nome_completo: String(formData.get('nome') || ''),
        // Declaração da própria pessoa sobre si, não privilégio — por isso é
        // seguro vir do metadata. `papel` nunca viria daqui (ver 0010).
        e_estudante_ufr: formData.get('ufr') === 'on',
        rga: String(formData.get('rga') || '').trim(),
      },
    },
  })

  if (error) return { ok: false, erro: traduzir(error.message) }

  /**
   * O DEFEITO QUE ESTA CHECAGEM CORRIGE
   *
   * Antes, esta função terminava em `redirect('/cursos')` direto. Isso só
   * funciona porque a confirmação de e-mail está DESLIGADA: sem ela, o signUp
   * devolve sessão na hora e a pessoa já entra logada.
   *
   * Com a confirmação ligada, `data.session` vem nulo — e o redirect jogaria a
   * pessoa em /cursos deslogada, sem erro e sem explicação nenhuma. Ela
   * concluiria que o cadastro falhou, tentaria de novo, receberia "e-mail já
   * cadastrado" e desistiria.
   *
   * É a lição 4.8 outra vez: caminho que hoje é IMPOSSÍVEL de executar vira o
   * caminho principal no dia em que a chave for virada no painel do Supabase —
   * e virar aquela chave não passa por build, por deploy nem por revisão.
   */
  if (!data.session) {
    return {
      ok: true,
      aviso: 'Conta criada. Enviamos um link de confirmação para o seu e-mail — clique nele para poder entrar. Se não aparecer em alguns minutos, confira a caixa de spam.',
    }
  }

  revalidatePath('/', 'layout')
  redirect('/cursos')
}

/**
 * Envio do link de redefinição de senha.
 *
 * POR QUE A RESPOSTA É SEMPRE A MESMA
 *
 * Dizer "esse e-mail não está cadastrado" transforma a tela de login num
 * verificador de cadastro: qualquer pessoa descobre quem tem conta aqui. Numa
 * plataforma de uma universidade, isso é informação sobre quem estuda o quê.
 * Por isso a mensagem de sucesso é idêntica nos dois casos, e o próprio
 * Supabase se comporta assim de propósito — ele não devolve erro para endereço
 * inexistente.
 */
export async function recuperarSenha(_estado: unknown, formData: FormData): Promise<Resposta> {
  const email = String(formData.get('email') || '').trim()
  if (!email) return { ok: false, erro: 'Informe o e-mail da sua conta.' }

  const supabase = await createClient()
  const base = await enderecoBase()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${base}/auth/callback?proximo=/nova-senha`,
  })

  if (error) return { ok: false, erro: traduzir(error.message) }

  return {
    ok: true,
    aviso: 'Se existir uma conta com esse e-mail, o link de redefinição já está a caminho. Ele vale por uma hora e só pode ser usado uma vez.',
  }
}

/**
 * Reenvia a confirmação de cadastro. Só faz sentido depois que a confirmação de
 * e-mail estiver religada no Supabase; até lá nunca será chamada, porque o erro
 * que a oferece nunca acontece.
 */
export async function reenviarConfirmacao(email: string): Promise<Resposta> {
  if (!email.trim()) return { ok: false, erro: 'Preencha o e-mail acima primeiro.' }

  const supabase = await createClient()
  const base = await enderecoBase()

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim(),
    options: { emailRedirectTo: `${base}/auth/callback?proximo=/meus-cursos` },
  })

  if (error) return { ok: false, erro: traduzir(error.message) }
  return { ok: true, aviso: 'Reenviamos o link de confirmação. Confira também a caixa de spam.' }
}

export async function sair() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}
