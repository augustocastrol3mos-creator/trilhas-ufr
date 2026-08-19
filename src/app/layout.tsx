import type { Metadata } from 'next'
import { Inter, IBM_Plex_Sans } from 'next/font/google'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import PublicShell from '@/components/PublicShell'
import './globals.css'
import { sessaoAtual } from '@/lib/auth'

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
