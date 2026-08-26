import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enderecoBase, caminhoInterno } from '@/lib/url'

/**
 * O ponto de chegada de TODO link de autenticação enviado por e-mail.
 *
 * POR QUE ESTA ROTA PRECISA EXISTIR
 *
 * O `@supabase/ssr` usa o fluxo PKCE. Nele, o link do e-mail não carrega a
 * sessão: ele carrega um CÓDIGO de uso único, e alguém precisa trocar esse
 * código por uma sessão chamando `exchangeCodeForSession`. Sem esta rota, o
 * clique no link não faz nada — a pessoa chega numa página qualquer, sem estar
 * logada e sem nenhuma explicação.
 *
 * Três fluxos dependem dela, e dois já existiam quebrados no projeto:
 *
 *   1. redefinição de senha   → chega aqui e segue para /nova-senha
 *   2. confirmação de cadastro → chega aqui e segue para /meus-cursos
 *   3. troca de e-mail no perfil (`trocarEmail`, em perfil/acoes.ts)
 *
 * O item 3 é o que mostra o tamanho do buraco: aquela função já mandava um link
 * de confirmação desde a 0031, e esse link nunca teve para onde ir.
 *
 * POR QUE UM ROUTE HANDLER E NÃO UMA PAGE
 *
 * `exchangeCodeForSession` grava cookies. Server Component não grava cookie —
 * é justamente o que aquele `catch {}` silencioso do `createClient` está
 * absorvendo. Route handler grava, e é o único lugar onde essa troca funciona.
 */
export async function GET(request: NextRequest) {
  const parametros = request.nextUrl.searchParams
  const base = await enderecoBase()

  function paraLogin(aviso: string) {
    const url = new URL('/login', base)
    url.searchParams.set('aviso', aviso)
    return NextResponse.redirect(url)
  }

  // O Supabase devolve o erro na própria query quando o link já foi usado ou
  // passou da validade (uma hora, por padrão). Traduzir aqui é o que evita que
  // a pessoa veja "otp_expired" e escreva para a coordenação.
  const codigoErro = parametros.get('error_code') ?? parametros.get('error')
  if (codigoErro) {
    return paraLogin(
      codigoErro.includes('expired')
        ? 'Esse link expirou ou já foi usado. Peça um novo abaixo.'
        : 'Não foi possível validar esse link. Peça um novo abaixo.'
    )
  }

  const codigo = parametros.get('code')
  if (!codigo) {
    return paraLogin('O link parece incompleto. Alguns programas de e-mail cortam links longos — tente copiar o endereço inteiro, ou peça um novo.')
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(codigo)

  if (error) {
    // Lição 4.9: nunca engolir erro de chamada ao Supabase. Aqui a pessoa
    // recebe uma frase útil e os logs da Vercel recebem a causa real.
    console.error('auth/callback exchangeCodeForSession:', error.message)
    return paraLogin('Esse link não vale mais. Peça um novo abaixo.')
  }

  const proximo = caminhoInterno(parametros.get('proximo'), '/meus-cursos')
  return NextResponse.redirect(new URL(proximo, base))
}
