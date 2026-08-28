'use client'

import { useState } from 'react'
import PainelVersoes, { type Versao } from './PainelVersoes'
import EditorItens, { type Item, type Competencia } from './EditorItens'

/**
 * Junta painel e editor porque a versão selecionada é estado compartilhado —
 * e é estado de tela, não de URL: trocar de versão para conferir não é uma
 * navegação que alguém queira ter no histórico do navegador.
 *
 * Os itens de TODAS as versões vêm prontos do servidor. São 53 frases por
 * versão e um punhado de versões; carregar tudo de uma vez custa menos que uma
 * ida ao banco a cada clique, e a troca fica instantânea.
 */
export default function GestaoQuestionario({
  versoes,
  itensPorVersao,
  competencias,
}: {
  versoes: Versao[]
  itensPorVersao: Record<string, Item[]>
  competencias: Competencia[]
}) {
  const ativa = versoes.find((v) => v.ativo) ?? versoes[0]
  const [selecionada, setSelecionada] = useState(ativa?.id ?? '')

  if (versoes.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-sm text-muted">
        Nenhuma versão do questionário existe ainda. Isso não deveria acontecer — a
        migration `0040` cria a versão 1. Fale com o contato técnico.
      </div>
    )
  }

  const versao = versoes.find((v) => v.id === selecionada) ?? ativa

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[20rem_1fr]">
      <PainelVersoes
        versoes={versoes}
        selecionada={selecionada}
        onSelecionar={setSelecionada}
      />

      <div>
        <h2 className="font-display text-base font-semibold text-ink">
          Frases da versão {versao.versao}
        </h2>
        <p className="mt-1 text-sm text-muted">
          Cada frase pertence a uma competência. A média das frases de uma competência é o
          que vira a faixa que o aluno vê.
        </p>
        <div className="mt-4">
          <EditorItens
            questionarioId={versao.id}
            ativa={versao.ativo}
            itens={itensPorVersao[versao.id] ?? []}
            competencias={competencias}
          />
        </div>
      </div>
    </div>
  )
}
