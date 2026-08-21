import { createPrivateKey, createPublicKey, sign as assinar } from 'node:crypto'

/**
 * Credencial verificável no formato Open Badges 3.0 (VC-JWT).
 *
 * ------------------------------------------------------------------------
 * POR QUE ISTO EXISTE
 * ------------------------------------------------------------------------
 * Hoje a validação de um certificado depende deste servidor estar de pé: o
 * verificador digita o código, a plataforma consulta o banco e responde. Se o
 * projeto for perdido, suspenso ou descontinuado, TODO certificado já emitido
 * vira link morto — e ninguém consegue provar nada.
 *
 * Uma credencial assinada inverte isso. O arquivo carrega os próprios dados e
 * uma assinatura criptográfica. Quem tem o arquivo e a chave pública verifica
 * sozinho, para sempre, sem nos consultar. Se um caractere for alterado, a
 * verificação falha.
 *
 * O formato segue o Open Badges 3.0 do 1EdTech, que é construído sobre o
 * modelo de Verifiable Credentials do W3C. O padrão é público e livre para
 * usar; só a certificação oficial de conformidade exige filiação, e ela é
 * dispensável para o que precisamos.
 *
 * ------------------------------------------------------------------------
 * ESCOLHA: VC-JWT, NÃO LINKED DATA PROOFS
 * ------------------------------------------------------------------------
 * O padrão aceita dois formatos de assinatura. Linked Data Proofs exige
 * canonicalização de JSON-LD — uma dependência pesada e uma fonte de erro
 * silencioso. VC-JWT é um JWS comum: cabeçalho, corpo e assinatura em
 * base64url. Dá para implementar com o `node:crypto` e verificar com qualquer
 * biblioteca de JWT do mundo. Para um projeto que precisa sobreviver sem
 * manutenção, menos dependência é mais garantia.
 *
 * ------------------------------------------------------------------------
 * SE A CHAVE NÃO ESTIVER CONFIGURADA
 * ------------------------------------------------------------------------
 * A credencial é devolvida sem assinatura, com um aviso explícito. Nada quebra
 * — a plataforma continua funcionando exatamente como antes, e o campo `proof`
 * simplesmente não existe. É melhor do que derrubar a rota e melhor do que
 * fingir que está assinado.
 */

const b64url = (b: Buffer | string) =>
  Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export type DadosCredencial = {
  codigo: string
  valido: boolean
  revogadoEm: string | null
  nomeTitular: string
  rgaTitular: string | null
  emailTitular: string
  cursoTitulo: string
  cursoDescricao: string | null
  categoria: string | null
  cargaHoraria: number
  modalidade: string
  notaFinal: number | null
  periodoInicio: string | null
  periodoFim: string | null
  conteudo: string[] | null
  emitidoEm: string
  instituicao: string
  instituicaoSigla: string
  orgaoEmissor: string
  urlBase: string
}

export function montarCredencial(d: DadosCredencial) {
  const issuer = `${d.urlBase}/emissor`
  const idCredencial = `${d.urlBase}/validar/${d.codigo}`

  return {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json',
    ],
    id: idCredencial,
    type: ['VerifiableCredential', 'OpenBadgeCredential'],
    name: `Certificado — ${d.cursoTitulo}`,
    issuer: {
      id: issuer,
      type: ['Profile'],
      name: d.instituicao,
      description: d.orgaoEmissor,
      url: d.urlBase,
    },
    validFrom: new Date(d.emitidoEm).toISOString(),
    credentialSubject: {
      type: ['AchievementSubject'],
      // `identifier` no lugar de e-mail solto: o padrão prevê identificadores
      // tipados, e o RGA é o que a instituição usa para conferir de verdade.
      identifier: [
        ...(d.rgaTitular
          ? [{ type: 'IdentityObject', identityType: 'identifier', hashed: false, identityHash: d.rgaTitular }]
          : []),
        { type: 'IdentityObject', identityType: 'emailAddress', hashed: false, identityHash: d.emailTitular },
      ],
      achievement: {
        id: `${d.urlBase}/validar/${d.codigo}#achievement`,
        type: ['Achievement'],
        // Este é o campo que alinha com "gestão de competências": o padrão
        // distingue microcredencial de diploma, e é isso que o certificado é.
        achievementType: 'Micro-Credential',
        name: d.cursoTitulo,
        description: d.cursoDescricao ?? undefined,
        // `criteria` é o que separa credencial séria de figurinha: descreve o
        // que foi preciso fazer para obtê-la.
        criteria: {
          narrative: [
            `Percorreu integralmente a trilha do curso, com módulos liberados em sequência.`,
            d.notaFinal != null
              ? `Foi aprovado na avaliação, com aproveitamento final de ${d.notaFinal}.`
              : `Foi aprovado na avaliação do curso.`,
            d.modalidade === 'hibrido'
              ? `Teve presença confirmada nos encontros presenciais exigidos.`
              : `Curso realizado integralmente a distância.`,
          ].join(' '),
        },
        creditsAvailable: d.cargaHoraria,
        ...(d.categoria ? { tag: [d.categoria] } : {}),
      },
    },
    // Revogação faz parte da credencial: sem isto, um certificado revogado
    // continuaria "válido" para quem verificasse o arquivo offline.
    ...(d.valido
      ? {}
      : { validUntil: d.revogadoEm ? new Date(d.revogadoEm).toISOString() : undefined }),
    trilhas: {
      codigoValidacao: d.codigo,
      cargaHoraria: d.cargaHoraria,
      conteudoProgramatico: d.conteudo ?? [],
      periodo: { inicio: d.periodoInicio, fim: d.periodoFim },
      revogado: !d.valido,
      verificacaoOnline: idCredencial,
    },
  }
}

/** Assina no formato VC-JWT. Devolve null se não houver chave configurada. */
export function assinarCredencial(credencial: object, issuer: string): string | null {
  const pem = process.env.CREDENCIAL_CHAVE_PRIVADA
  if (!pem) return null

  try {
    const chave = createPrivateKey(pem.replace(/\\n/g, '\n'))

    const cabecalho = { alg: 'EdDSA', typ: 'JWT', kid: `${issuer}#chave-1` }
    const corpo = {
      iss: issuer,
      vc: credencial,
      iat: Math.floor(Date.now() / 1000),
    }

    const entrada = `${b64url(JSON.stringify(cabecalho))}.${b64url(JSON.stringify(corpo))}`
    // Ed25519 assina a mensagem inteira; o algoritmo de hash é null por design.
    const assinatura = assinar(null, Buffer.from(entrada), chave)

    return `${entrada}.${b64url(assinatura)}`
  } catch {
    return null
  }
}

/** Chave pública em JWK, para quem for verificar. */
export function chavePublicaJwk(): Record<string, unknown> | null {
  const pem = process.env.CREDENCIAL_CHAVE_PRIVADA
  if (!pem) return null

  try {
    const publica = createPublicKey(createPrivateKey(pem.replace(/\\n/g, '\n')))
    const jwk = publica.export({ format: 'jwk' }) as Record<string, unknown>
    return { ...jwk, alg: 'EdDSA', use: 'sig', kid: 'chave-1' }
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------------
 * VERIFICAÇÃO
 * ------------------------------------------------------------------------ */

import { createPublicKey as _pub, verify as _verify } from 'node:crypto'

const doB64url = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')

export type Resultado = {
  assinaturaValida: boolean
  motivo: string
  emissor?: string
  credencial?: Record<string, unknown>
  emitidoPara?: string
  curso?: string
  codigo?: string
  revogado?: boolean
}

/**
 * Verifica uma credencial assinada contra uma chave pública em JWK.
 *
 * Repare no que ISTO NÃO FAZ: não consulta o banco, não consulta a internet,
 * não depende de nada além dos dois argumentos. É essa propriedade que torna a
 * credencial verificável mesmo depois que a plataforma deixar de existir.
 *
 * O que a assinatura prova: que este arquivo foi emitido por quem detém a
 * chave privada correspondente, e que nem um caractere mudou desde então.
 * O que ela NÃO prova: que o certificado continua válido hoje — revogação é
 * um fato posterior, e por isso o resultado também informa se a credencial
 * nasceu marcada como revogada.
 */
export function verificarCredencial(
  arquivo: unknown,
  jwk: Record<string, unknown>
): Resultado {
  const doc = arquivo as Record<string, any>

  const jws = doc?.proof?.jws
  if (typeof jws !== 'string') {
    return {
      assinaturaValida: false,
      motivo:
        'Este arquivo não contém assinatura. Ele pode ser uma credencial emitida antes de a assinatura ser configurada, ou um arquivo montado por outra pessoa.',
    }
  }

  const partes = jws.split('.')
  if (partes.length !== 3) {
    return { assinaturaValida: false, motivo: 'A assinatura está malformada.' }
  }

  try {
    const chave = _pub({ key: jwk as any, format: 'jwk' })
    const entrada = Buffer.from(`${partes[0]}.${partes[1]}`)
    const ok = _verify(null, entrada, chave, doB64url(partes[2]))

    if (!ok) {
      return {
        assinaturaValida: false,
        motivo:
          'A assinatura NÃO confere. Ou o conteúdo foi alterado depois de emitido, ou o arquivo foi assinado por outra chave.',
      }
    }

    const corpo = JSON.parse(doB64url(partes[1]).toString('utf8'))
    const vc = corpo?.vc ?? {}
    const t = vc?.trilhas ?? {}

    return {
      assinaturaValida: true,
      motivo: 'Assinatura confere: o conteúdo é autêntico e não foi alterado.',
      emissor: corpo?.iss,
      credencial: vc,
      emitidoPara: vc?.credentialSubject?.identifier?.[0]?.identityHash,
      curso: vc?.credentialSubject?.achievement?.name,
      codigo: t?.codigoValidacao,
      revogado: Boolean(t?.revogado),
    }
  } catch (e) {
    return {
      assinaturaValida: false,
      motivo: `Não foi possível verificar: ${(e as Error).message}`,
    }
  }
}
