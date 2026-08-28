import FormularioAcesso from '@/components/FormularioAcesso'
import { caminhoInterno } from '@/lib/url'

/**
 * Server Component lê `searchParams` por props — não precisa de `useSearchParams`
 * nem do <Suspense> que existia aqui antes. O `LoginForms` intermediário foi
 * removido: ele só existia para ler esses parâmetros no cliente.
 *
 * `caminhoInterno` no `proximo` pela mesma razão do /auth/callback: esse valor
 * vem da URL, e sem a guarda `?proximo=https://site-falso` levaria a pessoa para
 * fora do domínio logo depois de autenticar.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ proximo?: string; aviso?: string; recuperar?: string }>
}) {
  const p = await searchParams

  return (
    <div className="mx-auto max-w-sm">
      <FormularioAcesso
        variante="pagina"
        proximo={caminhoInterno(p.proximo, '/meus-cursos')}
        avisoInicial={p.aviso ?? null}
        abaInicial={p.recuperar ? 'recuperar' : 'entrar'}
      />
    </div>
  )
}
