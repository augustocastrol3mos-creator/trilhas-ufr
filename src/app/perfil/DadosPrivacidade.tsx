'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Clock, Lock, Mail, PencilLine, ShieldCheck, X } from 'lucide-react'
import { solicitarDados, cancelarSolicitacao, trocarSenha, trocarEmail } from './acoes'

export type Solicitacao = {
  id: string
  nome_solicitado: string | null
  rga_solicitado: string | null
  status: string
  resposta: string | null
} | null

const campo =
  'mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-ink'
const rotulo = 'block text-xs font-medium text-muted'

type R = { ok: boolean; erro?: string; aviso?: string }

export default function DadosPrivacidade({
  nome, rga, email, travado, solicitacao,
}: {
  nome: string
  rga: string | null
  email: string
  travado: boolean
  solicitacao: Solicitacao
}) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [msg, setMsg] = useState<{ erro?: string; ok?: string } | null>(null)
  const [painel, setPainel] = useState<'nenhum' | 'dados' | 'email' | 'senha'>('nenhum')

  const [novoNome, setNovoNome] = useState(nome)
  const [novoRga, setNovoRga] = useState(rga ?? '')
  const [motivo, setMotivo] = useState('')
  const [novoEmail, setNovoEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [senha2, setSenha2] = useState('')

  function rodar(fn: () => Promise<R>, aoDar?: () => void) {
    setMsg(null)
    iniciar(async () => {
      const r = await fn()
      if (!r.ok) setMsg({ erro: r.erro ?? 'nao foi possivel concluir' })
      else {
        setMsg({ ok: r.aviso ?? 'Pronto.' })
        setPainel('nenhum')
        aoDar?.()
        router.refresh()
      }
    })
  }

  const aguardando = solicitacao?.status === 'pendente'

  return (
    <div className="rounded-lg border border-border bg-surface p-6">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
        Dados e privacidade
      </h2>

      {msg?.erro && (
        <p className="mt-3 rounded-md border border-danger-soft bg-danger-soft px-3 py-2 text-sm text-danger">
          {msg.erro}
        </p>
      )}
      {msg?.ok && (
        <p className="mt-3 rounded-md border border-success-soft bg-success-soft px-3 py-2 text-sm text-success">
          {msg.ok}
        </p>
      )}

      {/* ---------- nome e RGA ----------
          Quando destravado, a edição vive no formulário acima; aqui só o
          resumo, para a seção continuar respondendo "o que vocês guardam". */}
      <div className="mt-4 border-b border-border pb-5">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className={rotulo}>Nome completo</dt>
            <dd className="mt-0.5 text-sm text-ink">{nome || '(não preenchido)'}</dd>
          </div>
          <div>
            <dt className={rotulo}>RGA</dt>
            <dd className="mt-0.5 font-mono text-sm text-ink">{rga || '—'}</dd>
          </div>
        </dl>

        <p className="mt-2 text-xs leading-relaxed text-subtle">
          Os dois vão impressos no certificado.{' '}
          {travado
            ? 'Depois da primeira inscrição, correções passam pela coordenação.'
            : 'Enquanto você não se inscrever em nenhum curso, pode editar direto no formulário abaixo.'}
        </p>

        {travado && aguardando && (
          <div className="mt-3 rounded-md border border-accent-soft bg-accent-soft p-3.5">
            <p className="flex items-center gap-2 text-sm font-medium text-ink">
              <Clock className="h-4 w-4 text-accent" aria-hidden="true" />
              Correção aguardando a coordenação
            </p>
            <ul className="mt-1 space-y-0.5 text-sm text-muted">
              {solicitacao?.nome_solicitado && <li>Nome → {solicitacao.nome_solicitado}</li>}
              {solicitacao?.rga_solicitado && <li>RGA → {solicitacao.rga_solicitado}</li>}
            </ul>
            <button
              onClick={() => rodar(() => cancelarSolicitacao(solicitacao!.id))}
              disabled={pendente}
              className="mt-2 text-sm font-medium text-muted underline hover:text-ink disabled:opacity-50"
            >
              Cancelar o pedido
            </button>
          </div>
        )}

        {travado && !aguardando && solicitacao?.status === 'recusada' && (
          <p className="mt-3 rounded-md border border-border bg-canvas p-3 text-sm">
            <span className="flex items-center gap-2 font-medium text-ink">
              <X className="h-4 w-4 text-muted" aria-hidden="true" />
              Pedido anterior não aprovado
            </span>
            {solicitacao.resposta && (
              <span className="mt-1 block text-muted">{solicitacao.resposta}</span>
            )}
          </p>
        )}

        {travado && !aguardando && (
          painel === 'dados' ? (
            <div className="mt-3 rounded-md border border-border bg-canvas p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={rotulo}>
                  Nome completo
                  <input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} className={campo} />
                </label>
                <label className={rotulo}>
                  RGA
                  <input
                    value={novoRga}
                    onChange={(e) => setNovoRga(e.target.value)}
                    inputMode="numeric"
                    maxLength={12}
                    placeholder="202300000000"
                    className={campo}
                  />
                </label>
              </div>

              <label className={`mt-3 ${rotulo}`}>
                O que precisa ser corrigido
                <input
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ex: nova matrícula após reingresso"
                  className={campo}
                />
              </label>

              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={() =>
                    rodar(() => solicitarDados(novoNome, novoRga, motivo), () => setMotivo(''))
                  }
                  disabled={pendente || motivo.trim().length < 10}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
                >
                  {pendente ? 'Enviando…' : 'Enviar pedido'}
                </button>
                <button onClick={() => setPainel('nenhum')} className="text-sm font-medium text-muted hover:text-ink">
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setPainel('dados')}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <PencilLine className="h-3.5 w-3.5" />
              Solicitar correção de nome ou RGA
            </button>
          )
        )}
      </div>

      {/* ---------- e-mail ---------- */}
      <div className="border-b border-border py-5">
        <dt className={rotulo}>E-mail de acesso</dt>
        <dd className="mt-0.5 text-sm text-ink">{email}</dd>

        {painel === 'email' ? (
          <div className="mt-3 rounded-md border border-border bg-canvas p-4">
            <label className={rotulo}>
              Novo e-mail
              <input
                type="email"
                value={novoEmail}
                onChange={(e) => setNovoEmail(e.target.value)}
                className={campo}
              />
            </label>
            <p className="mt-1.5 text-xs text-subtle">
              Enviaremos um link de confirmação para o novo endereço. Até você clicar
              nele, o acesso continua pelo e-mail atual.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={() => rodar(() => trocarEmail(novoEmail), () => setNovoEmail(''))}
                disabled={pendente || !novoEmail.includes('@')}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {pendente ? 'Enviando…' : 'Enviar confirmação'}
              </button>
              <button onClick={() => setPainel('nenhum')} className="text-sm font-medium text-muted hover:text-ink">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setPainel('email')}
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <Mail className="h-3.5 w-3.5" />
            Trocar e-mail
          </button>
        )}
      </div>

      {/* ---------- senha ---------- */}
      <div className="border-b border-border py-5">
        <dt className={rotulo}>Senha</dt>
        <dd className="mt-0.5 text-sm text-muted">••••••••</dd>

        {painel === 'senha' ? (
          <div className="mt-3 rounded-md border border-border bg-canvas p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={rotulo}>
                Nova senha
                <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} className={campo} />
              </label>
              <label className={rotulo}>
                Repita a nova senha
                <input type="password" value={senha2} onChange={(e) => setSenha2(e.target.value)} className={campo} />
              </label>
            </div>
            {senha2 && senha !== senha2 && (
              <p className="mt-2 text-xs text-danger">As duas senhas não são iguais.</p>
            )}
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={() => rodar(() => trocarSenha(senha), () => { setSenha(''); setSenha2('') })}
                disabled={pendente || senha.length < 6 || senha !== senha2}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {pendente ? 'Salvando…' : 'Alterar senha'}
              </button>
              <button onClick={() => setPainel('nenhum')} className="text-sm font-medium text-muted hover:text-ink">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setPainel('senha')}
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <Lock className="h-3.5 w-3.5" />
            Trocar senha
          </button>
        )}
      </div>

      {/* ---------- o que guardamos ---------- */}
      <div className="pt-5">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          O que guardamos sobre você
        </p>
        <ul className="mt-2 space-y-1 text-xs leading-relaxed text-muted">
          <li>
            <strong className="text-ink">Nome e RGA</strong> — impressos no certificado e
            usados pela coordenação para conferi-lo contra o registro acadêmico.
          </li>
          <li>
            <strong className="text-ink">E-mail</strong> — só para acesso e comunicação
            sobre os cursos.
          </li>
          <li>
            <strong className="text-ink">Seu percurso</strong> — progresso, notas,
            presença e certificados dos cursos em que você se inscreveu.
          </li>
          <li className="flex gap-1.5">
            <Check className="mt-0.5 h-3 w-3 shrink-0 text-success" aria-hidden="true" />
            Certificado emitido é registro institucional e não pode ser apagado, nem por
            você nem pela coordenação — apenas revogado, mantendo o histórico.
          </li>
        </ul>
      </div>
    </div>
  )
}
