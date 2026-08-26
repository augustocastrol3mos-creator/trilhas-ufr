import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import FormNovaSenha from './FormNovaSenha'

/**
 * Onde a pessoa define a senha depois de clicar no link do e-mail.
 *
 * COMO ESTA TELA SE PROTEGE
 *
 * Ela não recebe token nenhum. Quando o /auth/callback trocou o código por
 * sessão, a pessoa JÁ ESTÁ AUTENTICADA ao chegar aqui — é assim que o fluxo de
 * recuperação do Supabase funciona, e é por isso que a única verificação
 * necessária é "existe sessão".
 *
 * Vale entender a consequência, porque ela surpreende: quem tem acesso à caixa
 * de e-mail de alguém consegue entrar na conta dessa pessoa. Isso não é falha
 * desta implementação, é o modelo de qualquer "esqueci minha senha" do mundo —
 * o e-mail é a chave mestra. O que reduz o risco é o link expirar em uma hora e
 * valer uma única vez.
 *
 * A guarda é a mesma camada 2 da seção 3 do ARQUITETURA (`exigirAdmin()` e
 * companhia): o middleware já bloqueia /nova-senha para quem não tem sessão,
 * mas middleware falha em silêncio se alguém editar o `matcher`. Duas camadas.
 */
export default async function NovaSenhaPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error) console.error('nova-senha getUser:', error.message)

  if (!user) {
    redirect('/login?aviso=' + encodeURIComponent(
      'Para definir uma senha nova, use o link que enviamos por e-mail. Peça um abaixo.'
    ))
  }

  return (
    <div className="mx-auto max-w-sm">
      <FormNovaSenha email={user.email ?? ''} />
    </div>
  )
}
