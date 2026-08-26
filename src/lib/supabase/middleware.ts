import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Rotas que exigem login, e com que papel.
 *
 * Até aqui, `/admin` estava na mesma lista de `/meus-cursos`: a única condição
 * era estar logado. Qualquer aluno que digitasse `/admin/usuarios` chegava lá.
 *
 * Na prática pouca coisa vazava, porque o RLS limitava cada consulta ao dono e
 * toda ação passa por RPC com e_admin(). Mas isso significa que aquelas telas
 * dependiam EXCLUSIVAMENTE do RLS — a camada que a seção 3 do ESTADO_DO_PROJETO
 * manda não usar sozinha, e que já falhou cinco vezes neste projeto. Bastaria
 * alguém acrescentar uma policy de leitura ampla para virarem vazamento real no
 * mesmo instante, sem nenhum aviso.
 *
 * `/auth/callback` NÃO entra nesta lista, e isso é essencial: é justamente a
 * rota que a pessoa acessa SEM sessão, vinda do link do e-mail, para ganhar
 * uma. Exigir login ali criaria um laço — precisaria estar logado para
 * conseguir logar.
 */
const ROTAS: { prefixo: string; papeis?: string[] }[] = [
  { prefixo: '/meus-cursos' },
  { prefixo: '/trilha' },
  { prefixo: '/certificados' },
  { prefixo: '/perfil' },
  // A sessão de recuperação de senha é uma sessão comum: quando o
  // /auth/callback termina, a pessoa já está autenticada. Por isso a proteção
  // desta tela é a mesma das outras, sem nenhum caso especial.
  { prefixo: '/nova-senha' },
  { prefixo: '/professor', papeis: ['instrutor', 'admin'] },
  { prefixo: '/admin', papeis: ['admin'] },
]

export async function atualizarSessao(request: NextRequest) {
  const caminho = request.nextUrl.pathname
  const regra = ROTAS.find((r) => caminho.startsWith(r.prefixo))
  const precisaLogin = Boolean(regra)

  function paraLogin() {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('proximo', caminho)
    return NextResponse.redirect(url)
  }

  // Visitante sem cookie de sessão: não há token para renovar nem usuário para
  // autorizar. getUser() é ida e volta na rede até o servidor de Auth do
  // Supabase — pagar isso em /validar, a página mais acessada por quem nem tem
  // conta, era gasto puro.
  const temSessao = request.cookies.getAll().some((c) => c.name.startsWith('sb-'))

  if (!temSessao) {
    return precisaLogin ? paraLogin() : NextResponse.next({ request })
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user && precisaLogin) return paraLogin()

  // Checagem de papel. Só consulta o banco quando a rota de fato exige um papel
  // — /trilha e /meus-cursos continuam sem consulta nenhuma, que é a maioria
  // absoluta do tráfego de aluno.
  if (user && regra?.papeis) {
    const { data } = await supabase
      .from('usuario')
      .select('papel')
      .eq('id', user.id)
      .single()

    if (!data || !regra.papeis.includes(data.papel)) {
      // Devolve à página inicial, não ao login: a pessoa ESTÁ autenticada, só
      // não tem o papel. Mandar para o login sugeriria que ela precisa entrar
      // de novo, e ela ficaria num laço sem entender por quê.
      const url = request.nextUrl.clone()
      url.pathname = '/'
      url.searchParams.set('semAcesso', '1')
      return NextResponse.redirect(url)
    }
  }

  return response
}
