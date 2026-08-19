'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home, BookOpen, GraduationCap, Award, LogOut, Menu, X, User, ShieldCheck, Presentation, Settings,
} from 'lucide-react'
import { sair } from '@/app/login/actions'
import Marca from './Marca'
import Avisos, { type Aviso } from './Avisos'

type Usuario = { nome: string; email: string; papel: string } | null

const NAV = [
  { href: '/', label: 'Início', Icon: Home, exato: true },
  { href: '/cursos', label: 'Cursos', Icon: BookOpen, exato: false },
  { href: '/meus-cursos', label: 'Meus cursos', Icon: GraduationCap, exato: false },
  { href: '/certificados', label: 'Certificados', Icon: Award, exato: false },
  { href: '/validar', label: 'Validar certificado', Icon: ShieldCheck, exato: false },
]

export default function AppShell({
  usuario, avisos = [], children,
}: { usuario: Usuario; avisos?: Aviso[]; children: React.ReactNode }) {
  const pathname = usePathname()
  const [aberto, setAberto] = useState(false)

  const ehProfessor = usuario?.papel === 'instrutor' || usuario?.papel === 'admin'
  const ehAdmin = usuario?.papel === 'admin'
  let itens = ehProfessor
    ? [...NAV, { href: '/professor', label: 'Área do professor', Icon: Presentation, exato: false }]
    : NAV
  if (ehAdmin) {
    itens = [...itens, { href: '/admin', label: 'Coordenação', Icon: Settings, exato: false }]
  }

  const ativo = (href: string, exato: boolean) =>
    exato ? pathname === href : pathname.startsWith(href)

  return (
    <div className="min-h-screen md:flex">
      {/* Topbar mobile */}
      <div className="no-print flex items-center justify-between border-b border-border bg-white px-4 py-3 md:hidden">
        <Marca compacta />
        <button onClick={() => setAberto((v) => !v)} aria-label="Abrir menu">
          {aberto ? <X className="h-5 w-5 text-ink" /> : <Menu className="h-5 w-5 text-ink" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`
          no-print w-full shrink-0 border-border bg-surface md:block md:w-64 md:border-r
          ${aberto ? 'block' : 'hidden'}
        `}
      >
        <div className="flex h-full flex-col md:sticky md:top-0 md:h-screen">
          {/* Com a barra clara, a área de proteção do logotipo exigida pelo
              manual da UFR é a própria superfície: nada de bloco branco
              sobreposto, nada de emenda. */}
          <div className="hidden items-center border-b border-border px-5 py-5 md:flex">
            <Marca />
          </div>

          <nav className="flex-1 space-y-0.5 px-3 py-4">
            {itens.map(({ href, label, Icon, exato }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setAberto(false)}
                className={`
                  flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors
                  ${ativo(href, exato)
                    ? 'bg-primary-soft font-medium text-primary-dark'
                    : 'text-muted hover:bg-canvas hover:text-ink'}
                `}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="border-t border-border p-3">
            {usuario ? (
              <div className="rounded-md px-3 py-2">
                <div className="flex items-center gap-2 text-sm text-ink">
                  <User className="h-4 w-4 shrink-0 text-subtle" />
                  <Link href="/perfil" className="truncate hover:underline">{usuario.nome || usuario.email}</Link>
                </div>
                <form action={sair} className="mt-2">
                  <button className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted hover:bg-canvas hover:text-ink">
                    <LogOut className="h-4 w-4" />
                    Sair
                  </button>
                </form>
              </div>
            ) : (
              <Link
                href="/login"
                className="flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-dark"
              >
                Entrar
              </Link>
            )}
          </div>
        </div>
      </aside>

      {/* Conteúdo */}
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-5xl px-5 py-8 md:px-12 md:py-12">
          <Avisos avisos={avisos} />
          {children}
        </div>
      </main>
    </div>
  )
}
