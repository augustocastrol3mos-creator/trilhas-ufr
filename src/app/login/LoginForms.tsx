'use client'

import { useActionState, useState, useTransition } from 'react'
import { useSearchParams } from 'next/navigation'
import { Lock, UserPlus, KeyRound, ArrowLeft, MailCheck } from 'lucide-react'
import { entrar, cadastrar, recuperarSenha, reenviarConfirmacao, type Resposta } from './actions'

type Aba = 'entrar' | 'cadastrar' | 'recuperar'

export default function LoginForms() {
  const [ufr, setUfr] = useState(false)
  const parametros = useSearchParams()
  const proximo = parametros.get('proximo') ?? '/meus-cursos'

  // Mensagem trazida pelo /auth/callback quando o link do e-mail falhou. Ela
  // chega pela URL porque quem redireciona é um route handler, que não tem
  // estado de React para passar adiante.
  const avisoDaUrl = parametros.get('aviso')

  const [aba, setAba] = useState<Aba>('entrar')
  const [email, setEmail] = useState('')

  const [estadoEntrar, acaoEntrar, pendenteEntrar] = useActionState(entrar, null)
  const [estadoCadastro, acaoCadastro, pendenteCadastro] = useActionState(cadastrar, null)
  const [estadoRecuperar, acaoRecuperar, pendenteRecuperar] = useActionState(recuperarSenha, null)

  const [reenvio, setReenvio] = useState<Resposta | null>(null)
  const [reenviando, iniciarReenvio] = useTransition()

  const campo = 'mt-1.5 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-subtle focus:border-primary'
  const label = 'block text-sm font-medium text-ink'
  const botao = 'mt-6 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50'

  function Erro({ texto }: { texto: string }) {
    return <p className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{texto}</p>
  }

  function Sucesso({ texto }: { texto: string }) {
    return (
      <p className="mt-3 flex items-start gap-2 rounded-md border border-border bg-canvas px-3 py-2.5 text-sm text-ink">
        <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
        <span>{texto}</span>
      </p>
    )
  }

  function trocarAba(nova: Aba) {
    setAba(nova)
    setReenvio(null)
  }

  return (
    <div className="mx-auto max-w-sm">
      <div className="rounded-lg border border-border bg-surface p-6">
        {avisoDaUrl && aba === 'entrar' && (
          <p className="mb-5 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{avisoDaUrl}</p>
        )}

        {aba === 'recuperar' ? (
          <>
            <button
              onClick={() => trocarAba('entrar')}
              className="mb-5 flex items-center gap-1.5 text-sm text-muted hover:text-ink"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar
            </button>

            <h1 className="flex items-center gap-2 font-display text-base font-semibold text-ink">
              <KeyRound className="h-4 w-4 text-muted" />
              Redefinir senha
            </h1>
            <p className="mt-1.5 text-sm text-muted">
              Enviamos um link para o e-mail cadastrado. Ele vale por uma hora.
            </p>

            <form action={acaoRecuperar} className="mt-5">
              <label className={label}>
                E-mail da conta
                <input
                  name="email"
                  type="email"
                  required
                  defaultValue={email}
                  className={campo}
                />
              </label>
              <button disabled={pendenteRecuperar} className={botao}>
                {pendenteRecuperar ? 'Enviando...' : 'Enviar link'}
              </button>
              {estadoRecuperar?.erro && <Erro texto={estadoRecuperar.erro} />}
              {estadoRecuperar?.aviso && <Sucesso texto={estadoRecuperar.aviso} />}
            </form>
          </>
        ) : (
          <>
            <div className="mb-6 flex gap-1 rounded-md bg-canvas p-1">
              <button
                onClick={() => trocarAba('entrar')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                  aba === 'entrar' ? 'bg-surface text-ink shadow-sm' : 'text-muted'
                }`}
              >
                <Lock className="h-3.5 w-3.5" />
                Entrar
              </button>
              <button
                onClick={() => trocarAba('cadastrar')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                  aba === 'cadastrar' ? 'bg-surface text-ink shadow-sm' : 'text-muted'
                }`}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Criar conta
              </button>
            </div>

            {aba === 'entrar' ? (
              <form action={acaoEntrar}>
                <input type="hidden" name="proximo" value={proximo} />
                <label className={label}>
                  E-mail
                  <input
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={campo}
                  />
                </label>
                <label className={`mt-4 ${label}`}>
                  Senha
                  <input name="senha" type="password" required className={campo} />
                </label>

                <button
                  type="button"
                  onClick={() => trocarAba('recuperar')}
                  className="mt-2.5 text-sm text-muted underline underline-offset-2 hover:text-ink"
                >
                  Esqueci minha senha
                </button>

                <button disabled={pendenteEntrar} className={botao}>
                  {pendenteEntrar ? 'Entrando...' : 'Acessar'}
                </button>

                {estadoEntrar?.erro && <Erro texto={estadoEntrar.erro} />}

                {/* Reenvio oferecido no lugar exato onde o problema aparece.
                    Enquanto a confirmação de e-mail estiver desligada no
                    Supabase, este bloco nunca é exibido. */}
                {estadoEntrar?.naoConfirmado && (
                  <div className="mt-2">
                    <button
                      type="button"
                      disabled={reenviando}
                      onClick={() => iniciarReenvio(async () => setReenvio(await reenviarConfirmacao(email)))}
                      className="text-sm text-primary underline underline-offset-2 disabled:opacity-50"
                    >
                      {reenviando ? 'Reenviando...' : 'Reenviar link de confirmação'}
                    </button>
                    {reenvio?.erro && <Erro texto={reenvio.erro} />}
                    {reenvio?.aviso && <Sucesso texto={reenvio.aviso} />}
                  </div>
                )}
              </form>
            ) : (
              <form action={acaoCadastro}>
                <label className={label}>
                  Nome completo
                  <input name="nome" required className={campo} />
                </label>
                <label className={`mt-4 ${label}`}>
                  E-mail
                  <input
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={campo}
                  />
                </label>
                <label className={`mt-4 ${label}`}>
                  Senha
                  <input name="senha" type="password" required minLength={6} className={campo} />
                </label>

                {/* O vínculo com a UFR decide se o RGA é exigido. Participante da
                    comunidade em curso de extensão não tem RGA — exigir de todos
                    excluiria essas pessoas. */}
                <label className="mt-5 flex cursor-pointer items-start gap-2.5 rounded-md border border-border px-3 py-2.5">
                  <input
                    type="checkbox"
                    name="ufr"
                    checked={ufr}
                    onChange={(e) => setUfr(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]"
                  />
                  <span className="text-sm text-ink">
                    Sou estudante da UFR
                    <span className="mt-0.5 block text-xs text-muted">
                      Necessário para que o certificado sirva como atividade complementar
                    </span>
                  </span>
                </label>

                {ufr && (
                  <label className={`mt-4 ${label}`}>
                    RGA
                    <input
                      name="rga"
                      required
                      inputMode="numeric"
                      pattern="[0-9]{12}"
                      maxLength={12}
                      placeholder="202300000000"
                      className={campo}
                    />
                    <span className="mt-1 block text-xs text-subtle">
                      12 dígitos, começando pelo ano de ingresso. Ele será impresso no seu
                      certificado e não poderá ser alterado depois da primeira inscrição.
                    </span>
                  </label>
                )}

                <button disabled={pendenteCadastro} className={botao}>
                  {pendenteCadastro ? 'Criando...' : 'Criar conta'}
                </button>

                {estadoCadastro?.erro && <Erro texto={estadoCadastro.erro} />}
                {estadoCadastro?.aviso && <Sucesso texto={estadoCadastro.aviso} />}
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}
