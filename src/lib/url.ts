import { headers } from 'next/headers'

/**
 * O endereço público desta instalação, derivado da requisição em curso.
 *
 * POR QUE NÃO UMA VARIÁVEL DE AMBIENTE
 *
 * Os links que o Supabase manda por e-mail (confirmar cadastro, redefinir
 * senha) precisam de URL ABSOLUTA — o servidor de Auth roda fora daqui e não
 * tem como completar um caminho relativo. Uma `NEXT_PUBLIC_SITE_URL` resolveria,
 * mas seria mais uma configuração que a equipe permanente precisa lembrar de
 * ajustar, e cujo esquecimento só aparece quando alguém não consegue redefinir
 * a senha. Derivar da requisição funciona em localhost, em preview da Vercel e
 * em produção sem ninguém configurar nada.
 *
 * Isto é diferente do `configuracao.url_base` do banco, e os dois precisam
 * continuar separados: aquele é o endereço IMPRESSO no certificado, escolhido
 * pela coordenação e estável por anos. Este é o endereço de onde a pessoa está
 * acessando agora. Num preview da Vercel eles são legitimamente diferentes.
 *
 * `x-forwarded-host` vem antes de `host` porque atrás do proxy da Vercel o
 * `host` é o domínio interno, não o que a pessoa digitou.
 */
export async function enderecoBase(): Promise<string> {
  const h = await headers()

  // Em Server Action o navegador manda `origin`. Em navegação direta (o clique
  // no link do e-mail, que cai no route handler) ele não existe.
  const origem = h.get('origin')
  if (origem) return origem

  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const protocolo = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${protocolo}://${host}`
}

/**
 * Só devolve o caminho se ele for interno a esta aplicação.
 *
 * O `/auth/callback` recebe para onde ir depois num parâmetro da URL, e essa URL
 * viaja dentro de um e-mail. Sem esta checagem, um link montado à mão levaria a
 * pessoa a `/auth/callback?proximo=https://site-falso` — ela clicaria num
 * endereço legítimo da UFR, seria autenticada de verdade, e cairia em outro
 * domínio já logada. É a família de falha chamada "open redirect", e ela é
 * especialmente perigosa aqui porque o link vem de um e-mail que a pessoa tem
 * boa razão para confiar.
 *
 * Rejeitar o que não começa com `/` cobre `https://...`. Rejeitar `//` cobre
 * `//site-falso`, que o navegador lê como URL absoluta herdando o protocolo.
 */
export function caminhoInterno(valor: string | null | undefined, padrao: string): string {
  if (!valor) return padrao
  if (!valor.startsWith('/')) return padrao
  if (valor.startsWith('//')) return padrao
  return valor
}
