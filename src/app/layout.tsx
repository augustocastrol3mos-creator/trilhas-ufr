import type { Metadata } from 'next'
import { Inter, IBM_Plex_Sans } from 'next/font/google'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import PublicShell from '@/components/PublicShell'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-plex-sans',
})

export const metadata: Metadata = {
  title: 'Trilhas UFR — cursos de extensão',
  description:
    'Cursos de extensão da Universidade Federal de Rondonópolis, com trilha de aprendizado e certificado validável.',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let papel: string | null = null
  if (user) {
    const { data } = await supabase.from('usuario').select('papel').eq('id', user.id).single()
    papel = data?.papel ?? 'aluno'
  }

  const usuario = user
    ? {
        nome: (user.user_metadata?.nome_completo as string) ?? '',
        email: user.email ?? '',
        papel: papel ?? 'aluno',
      }
    : null

  return (
    <html lang="pt-BR" className={`${inter.variable} ${plexSans.variable}`}>
      <body className="antialiased">
        {usuario ? (
          <AppShell usuario={usuario}>{children}</AppShell>
        ) : (
          <PublicShell>{children}</PublicShell>
        )}
      </body>
    </html>
  )
}
