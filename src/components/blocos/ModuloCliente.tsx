'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Check, PartyPopper } from 'lucide-react'
import BlocoRenderer from './BlocoRenderer'
import type { BlocoAluno, EstadoProgresso, ModuloTrilha } from '@/lib/blocos/schemas'

/**
 * Dono do estado do módulo. Antes, cada bloco cuidava de si e ninguém sabia
 * o total — por isso o aluno precisava recarregar a página para o próximo
 * módulo aparecer. Agora a conclusão sobe para cá e tudo reage junto.
 */
export default function ModuloCliente({
  blocos, matriculaId, proximo, ultimoModulo,
}: {
  blocos: BlocoAluno[]
  matriculaId: string
  proximo: ModuloTrilha | null
  ultimoModulo: boolean
}) {
  const router = useRouter()
  const jaRolou = useRef(false)

  const [estados, setEstados] = useState<Record<string, EstadoProgresso>>(() =>
    Object.fromEntries(blocos.map((b) => [b.blocoId, b.estado]))
  )

  const obrigatorios = useMemo(() => blocos.filter((b) => b.obrigatorio), [blocos])
  const feitos = obrigatorios.filter((b) => estados[b.blocoId] === 'concluido').length
  const completo = obrigatorios.length > 0 && feitos >= obrigatorios.length
  const percentual = obrigatorios.length === 0 ? 100 : (feitos / obrigatorios.length) * 100

  // Primeiro bloco pendente: é para onde o aluno deve olhar ao abrir
  const pendente = blocos.find((b) => b.obrigatorio && estados[b.blocoId] !== 'concluido')

  function concluir(blocoId: string) {
    setEstados((e) => (e[blocoId] === 'concluido' ? e : { ...e, [blocoId]: 'concluido' }))
    // atualiza a trilha e a matrícula no servidor, sem tirar o aluno da página
    router.refresh()
  }

  // Ao abrir um módulo já iniciado, leva o aluno ao ponto onde parou
  useEffect(() => {
    if (jaRolou.current || !pendente) return
    if (pendente.blocoId === blocos[0]?.blocoId) return
    jaRolou.current = true
    document
      .getElementById(`bloco-${pendente.blocoId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [pendente, blocos])

  return (
    <div>
      {/* Progresso do módulo, sempre visível */}
      <div className="sticky top-0 z-10 -mx-1 mb-6 bg-canvas/95 px-1 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${percentual}%` }}
            />
          </div>
          <span className="shrink-0 text-xs font-medium text-muted">
            {feitos} de {obrigatorios.length}
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface px-6">
        {blocos.map((b) => (
          <BlocoRenderer
            key={b.blocoId}
            bloco={b}
            matriculaId={matriculaId}
            estado={estados[b.blocoId]}
            onConcluir={() => concluir(b.blocoId)}
          />
        ))}
      </div>

      {/* Fim do módulo: reage à conclusão sem recarregar */}
      <div className="mt-6">
        {!completo && obrigatorios.length > 0 && (
          <p className="text-sm text-muted">
            Faltam {obrigatorios.length - feitos}{' '}
            {obrigatorios.length - feitos === 1 ? 'item obrigatório' : 'itens obrigatórios'} para
            concluir este módulo.
          </p>
        )}

        {completo && proximo && (
          <div className="rounded-lg border border-primary bg-primary-soft p-5">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-primary-dark" />
              <p className="font-display font-semibold text-ink">Módulo concluído</p>
            </div>
            <p className="mt-1 text-sm text-muted">
              O próximo módulo foi liberado: {proximo.titulo}
            </p>
            <Link
              href={`/trilha/${matriculaId}/${proximo.moduloId}`}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark"
            >
              Continuar para o próximo módulo
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {completo && !proximo && ultimoModulo && (
          <div className="rounded-lg border border-primary bg-primary-soft p-5">
            <div className="flex items-center gap-2">
              <PartyPopper className="h-4 w-4 text-primary-dark" />
              <p className="font-display font-semibold text-ink">Trilha concluída</p>
            </div>
            <p className="mt-1 text-sm text-muted">
              Você terminou todos os módulos deste curso.
            </p>
            <Link
              href={`/trilha/${matriculaId}`}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark"
            >
              Ver situação do curso
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
