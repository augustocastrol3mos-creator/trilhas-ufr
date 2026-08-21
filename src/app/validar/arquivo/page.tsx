import Link from 'next/link'
import { ArrowLeft, Terminal } from 'lucide-react'
import Verificador from './Verificador'

export const metadata = { title: 'Verificar credencial assinada — Trilhas UFR' }

export default function VerificarArquivoPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/validar" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" />
        Validar por código
      </Link>

      <h1 className="mt-4 font-display text-2xl font-semibold text-ink">
        Verificar credencial assinada
      </h1>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        Se você recebeu o arquivo <code className="text-ink">.json</code> de um
        certificado, esta página confere a assinatura criptográfica dele. Alterar um
        único caractere do arquivo faz a verificação falhar.
      </p>

      <div className="mt-6">
        <Verificador />
      </div>

      <div className="mt-8 rounded-lg border border-border bg-surface p-5">
        <p className="flex items-center gap-2 font-display text-sm font-semibold text-ink">
          <Terminal className="h-4 w-4 text-primary" aria-hidden="true" />
          Para conferir sem depender desta página
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Esta página é conveniência: se a plataforma sair do ar, ela sai junto. A
          verificação de verdade não precisa de nós — a credencial segue o padrão aberto
          Open Badges 3.0, e a{' '}
          <Link href="/emissor/chaves" className="font-medium text-primary hover:underline">
            chave pública do emissor
          </Link>{' '}
          é um arquivo comum que pode ser guardado em qualquer lugar.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          O repositório do projeto traz um verificador de linha de comando que roda
          offline, sem internet e sem bibliotecas:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-md bg-canvas p-3 text-xs text-ink">
node verificar-credencial.mjs credencial.json chave-publica.json
        </pre>
        <p className="mt-2 text-xs leading-relaxed text-subtle">
          Guarde esse script e a chave pública junto do livro de certificados. Com os
          três, os certificados já emitidos continuam comprováveis mesmo sem esta
          plataforma existir.
        </p>
      </div>
    </div>
  )
}
