import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const ROTAS_PROTEGIDAS = ['/meus-cursos', '/trilha', '/certificados', '/perfil', '/professor', '/admin']

export async function atualizarSessao(request: NextRequest) {
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

  const precisaLogin = ROTAS_PROTEGIDAS.some((r) =>
    request.nextUrl.pathname.startsWith(r)
  )

  if (!user && precisaLogin) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('proximo', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  return response
}
