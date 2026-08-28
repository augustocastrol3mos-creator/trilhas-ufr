'use client'

import { useActionState, useState, useTransition } from 'react'
import { Lock, UserPlus, KeyRound, ArrowLeft, MailCheck } from 'lucide-react'
import {
  entrar,
  cadastrar,
  recuperarSenha,
  reenviarConfirmacao,
  type Resposta,
} from '@/app/login/actions'

/**
 * O ÚNICO formulário de acesso da plataforma.
 *
 * POR QUE ELE EXISTE
 *
 * Antes havia dois, escritos separadamente: `LoginForms` em /login e
 * `AcessoHero` na página inicial. Compartilhavam as server actions, mas cada um
 * desenhava a própria interface — e foi assim que três defeitos apareceram só
 * num lado:
 *
 *   1. o "Esqueci minha senha" foi para /login e não para a home
 *   2. a home ignorava o campo `aviso` da resposta, então "conta criada, confira
 *      seu e-mail" era descartado em silêncio — o defeito da lição 4.10
 *      reaparecendo num arquivo que a correção não abriu
 *   3. a home nunca pediu RGA, então quem se cadastrava por lá entrava sempre
 *      como não-UFR e precisava passar pela fila de aprovação depois
 *
 * Nenhum dos três quebra build, e nenhum aparece em teste que só olha uma tela.
 * É o custo de interface duplicada: a correção mora num lugar e o defeito no
 * outro. Se um dia precisar de uma terceira variação, acrescente um valor em
 * `variante` — não copie este arquivo.
 *
 * `variante` muda só o VISUAL. O comportamento é o mesmo nos dois casos, e essa
 * separação é o que faz a unificação valer alguma coisa.
 */

type Aba = 'entrar' | 'cadastrar' | 'recuperar'

type Props = {
  /** 'cartao' é o bloco compacto do topo da home; 'pagina' é a tela /login. */
  variante?: 'cartao' | 'pagina'
  /** Para onde ir depois de entrar. */
  proximo?: string
  /** Mensagem trazida pelo /auth/callback quando o link do e-mail falhou. */
  avisoInicial?: string | null
  abaInicial?: Aba
}

const ESTILOS = {
  cartao: {
    caixa: 'rounded-xl border border-border bg-surface p-6 shadow-xl shadow-black/10',
    campo:
      'mt-1.5 w-full rounded-md border border-border-strong bg-canvas px-3 py-2 text-sm text-ink focus:border-primary focus:bg-surface',
    rotulo: 'block text-xs font-medium text-muted',
    espaco: 'mt-3',
    cabecalho: true,
    textoCriar: 'Criar conta gratuita',
  },
  pagina: {
    caixa: 'rounded-lg border border-border bg-surface p-6',
    campo:
      'mt-1.5 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-subtle focus:border-primary',
    rotulo: 'block text-sm font-medium text-ink',
    espaco: 'mt-4',
    cabecalho: false,
    textoCriar: 'Criar conta',
  },
} as const

export default function FormularioAcesso({
  variante = 'pagina',
  proximo = '/meus-cursos',
  avisoInicial = null,
  abaInicial = 'entrar',
}: Props) {
  const e = ESTILOS[variante]

  const [aba, setAba] = useState<Aba>(abaInicial)
  const [ufr, setUfr] = useState(false)
  const [email, setEmail] = useState('')

  const [estadoEntrar, acaoEntrar, pendenteEntrar] = useActionState(entrar, null)
  const [estadoCadastro, acaoCadastro, pendenteCadastro] = useActionState(cadastrar, null)
  const [estadoRecuperar, acaoRecuperar, pendenteRecuperar] = useActionState(recuperarSenha, null)

  const [reenvio, setReenvio] = useState<Resposta | null>(null)
  const [reenviando, iniciarReenvio] = useTransition()

  const botao =
    'mt-5 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50'

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
    <div className={e.caixa}>
      {e.cabecalho && aba !== 'recuperar' && (
        <div className="mb-4 flex items-center gap-2">
          <Lock className="h-4 w-4 text-primary" />
          <h2 className="font-display text-base font-semibold text-ink">Acesse a plataforma</h2>
        </div>
      )}

      {avisoInicial && aba === 'entrar' && (
        <p className="mb-5 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{avisoInicial}</p>
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

          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-ink">
            <KeyRound className="h-4 w-4 text-muted" />
            Redefinir senha
          </h2>
          <p className="mt-1.5 text-sm text-muted">
            Enviamos um link para o e-mail cadastrado. Ele vale por uma hora.
          </p>

          <form action={acaoRecuperar} className="mt-5">
            <label className={e.rotulo}>
              E-mail da conta
              <input name="email" type="email" required defaultValue={email} className={e.campo} />
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
          <div className="flex gap-1 rounded-md bg-canvas p-1">
            {(
              [
                ['entrar', 'Entrar', Lock],
                ['cadastrar', 'Criar conta', UserPlus],
              ] as const
            ).map(([valor, texto, Icone]) => (
              <button
                key={valor}
                onClick={() => trocarAba(valor)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                  aba === valor ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
                }`}
              >
                <Icone className="h-3.5 w-3.5" />
                {texto}
              </button>
            ))}
          </div>

          {aba === 'entrar' ? (
            <form action={acaoEntrar} className="mt-5">
              <input type="hidden" name="proximo" value={proximo} />
              <label className={e.rotulo}>
                E-mail
                <input
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  className={e.campo}
                />
              </label>
              <label className={`${e.espaco} ${e.rotulo}`}>
                Senha
                <input name="senha" type="password" required className={e.campo} />
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

              {/* Reenvio oferecido onde o problema aparece. Enquanto a
                  confirmação de e-mail estiver desligada no Supabase, este
                  bloco nunca é exibido. */}
              {estadoEntrar?.naoConfirmado && (
                <div className="mt-2">
                  <button
                    type="button"
                    disabled={reenviando}
                    onClick={() =>
                      iniciarReenvio(async () => setReenvio(await reenviarConfirmacao(email)))
                    }
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
            <form action={acaoCadastro} className="mt-5">
              <label className={e.rotulo}>
                Nome completo
                <input name="nome" required className={e.campo} />
                <span className="mt-1 block text-xs text-subtle">
                  É o nome que vai aparecer no seu certificado.
                </span>
              </label>
              <label className={`${e.espaco} ${e.rotulo}`}>
                E-mail
                <input
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  className={e.campo}
                />
              </label>
              <label className={`${e.espaco} ${e.rotulo}`}>
                Senha
                <input name="senha" type="password" required minLength={6} className={e.campo} />
              </label>

              {/* O vínculo com a UFR decide se o RGA é exigido. Participante da
                  comunidade em curso de extensão não tem RGA — exigir de todos
                  excluiria essas pessoas.

                  Este bloco FALTAVA na versão da página inicial. Sem ele, quem
                  se cadastrava pela home entrava sempre como não-UFR e sem RGA,
                  e o conserto passava pela fila de aprovação da coordenação. */}
              <label className="mt-5 flex cursor-pointer items-start gap-2.5 rounded-md border border-border px-3 py-2.5">
                <input
                  type="checkbox"
                  name="ufr"
                  checked={ufr}
                  onChange={(ev) => setUfr(ev.target.checked)}
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
                <label className={`${e.espaco} ${e.rotulo}`}>
                  RGA
                  <input
                    name="rga"
                    required
                    inputMode="numeric"
                    pattern="[0-9]{12}"
                    maxLength={12}
                    placeholder="202300000000"
                    className={e.campo}
                  />
                  <span className="mt-1 block text-xs text-subtle">
                    12 dígitos, começando pelo ano de ingresso. Ele será impresso no seu
                    certificado e não poderá ser alterado depois da primeira inscrição.
                  </span>
                </label>
              )}

              <button disabled={pendenteCadastro} className={botao}>
                {pendenteCadastro ? 'Criando...' : e.textoCriar}
              </button>

              {estadoCadastro?.erro && <Erro texto={estadoCadastro.erro} />}
              {estadoCadastro?.aviso && <Sucesso texto={estadoCadastro.aviso} />}
            </form>
          )}
        </>
      )}
    </div>
  )
}
