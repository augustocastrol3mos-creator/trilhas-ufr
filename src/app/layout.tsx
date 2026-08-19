import type { Metadata } from 'next'
import { Inter, IBM_Plex_Sans } from 'next/font/google'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import PublicShell from '@/components/PublicShell'
import './globals.css'
import { sessaoAtual } from '@/lib/auth'
import type { Aviso } from '@/components/Avisos'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-plex-sans',
})

export const metadata: Metadata = {
  title: 'Trilhas UFR — atividades complementares e extensão',
  description:
    'Cursos complementares e de extensão da Universidade Federal de Rondonópolis, com trilha de aprendizado e certificado de validação pública.',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Uma chamada só, compartilhada com todas as páginas desta renderização.
  const usuario = await sessaoAtual()

  // Avisos da coordenação. A filtragem por público mora dentro da RPC, junto
  // do papel do usuário — nenhuma tela reimplementa a regra. Só para quem está
  // logado: a área pública não mostra aviso interno.
  let avisos: Aviso[] = []
  if (usuario) {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('meus_avisos')
    // Aviso que falha não deve derrubar o app inteiro — mas falhar em silêncio
    // esconde o defeito (foi o que aconteceu com a 0025). Registrar no log do
    // servidor deixa o erro visível nos logs da Vercel sem quebrar a página.
    if (error) console.error('meus_avisos:', error.message)
    avisos = (data ?? []) as Aviso[]
  }

  return (
    <html lang="pt-BR" className={`${inter.variable} ${plexSans.variable}`}>
      <body className="antialiased">
        {usuario ? (
          <AppShell usuario={usuario} avisos={avisos}>{children}</AppShell>
        ) : (
          <PublicShell>{children}</PublicShell>
        )}
      </body>
    </html>
  )
}
