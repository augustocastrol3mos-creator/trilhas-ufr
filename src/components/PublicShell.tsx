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

      <footer className="bg-deep">
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

          <div className="mt-10 flex flex-col gap-2 border-t border-deep-border pt-6 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
            <p className="text-xs text-deep-muted">
              Universidade Federal de Rondonópolis · Rondonópolis, MT
            </p>

            {/* Crédito de autoria. No rodapé público e não na área logada: aqui
                é convenção institucional, lá competiria com a interface de quem
                está trabalhando. */}
            <p className="text-xs leading-relaxed text-deep-muted sm:text-right">
              Desenvolvido por{' '}
              <span className="text-deep-foreground">Augusto Castro Lemos</span>
              <span className="mx-1.5 hidden sm:inline">·</span>
              <br className="sm:hidden" />
              Projeto de extensão coordenado pelo{' '}
              <span className="text-deep-foreground">
                Prof. Dr. André Luís Janzkovski Cardoso
              </span>
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
      <p className="text-[11px] uppercase tracking-wider text-deep-muted">{titulo}</p>
      <ul className="mt-3 space-y-2">{children}</ul>
    </div>
  )
}

function ItemLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="text-sm text-deep-foreground hover:text-white">
        {children}
      </Link>
    </li>
  )
}

function ItemTexto({ children }: { children: React.ReactNode }) {
  return <li className="text-sm leading-relaxed text-deep-muted">{children}</li>
}
