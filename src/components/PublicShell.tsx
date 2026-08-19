'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Marca from './Marca'

export default function PublicShell({ children }: { children: React.ReactNode }) {
  const ehLanding = usePathname() === '/'

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3.5">
          <Link href="/" className="flex items-center gap-2.5">
            <Marca />
          </Link>

          <div className="flex items-center gap-5">
            <Link href="/cursos" className="hidden text-sm text-muted hover:text-ink sm:block">
              Cursos
            </Link>
            <Link href="/validar" className="hidden text-sm text-muted hover:text-ink sm:block">
              Validar certificado
            </Link>
            <Link
              href="/login"
              className="rounded-md bg-primary px-3.5 py-1.5 text-sm font-medium text-white hover:bg-primary-dark"
            >
              Entrar
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {ehLanding ? children : <div className="mx-auto max-w-4xl px-6 py-12">{children}</div>}
      </main>

      <footer className="bg-sidebar">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <Coluna titulo="Acessos">
              <ItemLink href="/login">Entrar</ItemLink>
              <ItemLink href="/login">Criar conta</ItemLink>
            </Coluna>
            <Coluna titulo="Cursos">
              <ItemLink href="/cursos">Catálogo completo</ItemLink>
              <ItemLink href="/meus-cursos">Minhas trilhas</ItemLink>
            </Coluna>
            <Coluna titulo="Certificação">
              <ItemLink href="/validar">Validar certificado</ItemLink>
              <ItemLink href="/certificados">Meus certificados</ItemLink>
            </Coluna>
            <Coluna titulo="Sobre">
              <ItemTexto>Cursos ministrados por docentes da UFR e convidados</ItemTexto>
              <ItemTexto>Atividades complementares e cursos de extensão</ItemTexto>
            </Coluna>
          </div>

          <div className="mt-10 border-t border-sidebar-border pt-6">
            <p className="text-xs text-sidebar-muted">
              Universidade Federal de Rondonópolis · Rondonópolis, MT
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function Coluna({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-sidebar-muted">{titulo}</p>
      <ul className="mt-3 space-y-2">{children}</ul>
    </div>
  )
}

function ItemLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="text-sm text-sidebar-foreground hover:text-white">
        {children}
      </Link>
    </li>
  )
}

function ItemTexto({ children }: { children: React.ReactNode }) {
  return <li className="text-sm leading-relaxed text-sidebar-muted">{children}</li>
}
