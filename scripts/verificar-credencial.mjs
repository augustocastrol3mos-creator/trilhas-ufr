// Verificador de credencial do Trilhas UFR — funciona OFFLINE e para sempre.
//
//   node verificar-credencial.mjs credencial-UFR-2026-XXXXXX.json chave-publica.json
//
// ---------------------------------------------------------------------------
// GUARDE ESTE ARQUIVO JUNTO DA CHAVE PÚBLICA
// ---------------------------------------------------------------------------
// Ele não depende da plataforma, nem de internet, nem de nenhuma biblioteca
// além do Node. Se o Trilhas UFR deixar de existir, este script mais a chave
// pública continuam permitindo conferir qualquer certificado já emitido.
//
// A chave pública é o segundo bloco impresso por gerar-chave-credencial.mjs, e
// também está publicada em <endereço da plataforma>/emissor/chaves
//
// O que a assinatura prova: que o arquivo foi emitido por quem detém a chave
// privada da instituição, e que nem um caractere mudou desde então.
// O que ela não prova: que o certificado não foi revogado DEPOIS de emitido.

import { readFileSync } from 'node:fs'
import { createPublicKey, verify } from 'node:crypto'

const [, , arquivoCred, arquivoChave] = process.argv

if (!arquivoCred || !arquivoChave) {
  console.error('uso: node verificar-credencial.mjs <credencial.json> <chave-publica.json>')
  process.exit(2)
}

const cred = JSON.parse(readFileSync(arquivoCred, 'utf8'))
let jwk = JSON.parse(readFileSync(arquivoChave, 'utf8'))
// aceita tanto a chave solta quanto o formato { keys: [...] } de /emissor/chaves
if (Array.isArray(jwk?.keys)) jwk = jwk.keys[0]

const jws = cred?.proof?.jws
if (!jws) {
  console.error('\n✗ ESTE ARQUIVO NÃO TEM ASSINATURA.\n')
  process.exit(1)
}

const [cab, corpo, assin] = jws.split('.')
const b64 = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')

const ok = verify(
  null,
  Buffer.from(`${cab}.${corpo}`),
  createPublicKey({ key: jwk, format: 'jwk' }),
  b64(assin)
)

if (!ok) {
  console.error('\n✗ ASSINATURA NÃO CONFERE.')
  console.error('  O conteúdo foi alterado, ou foi assinado por outra chave.\n')
  process.exit(1)
}

const vc = JSON.parse(b64(corpo).toString('utf8')).vc ?? {}
const t = vc.trilhas ?? {}
const s = vc.credentialSubject ?? {}

console.log('\n✓ ASSINATURA CONFERE — o conteúdo é autêntico e não foi alterado.\n')
console.log('  Titular ...... ', s.identifier?.map((i) => i.identityHash).join(' · ') ?? '—')
console.log('  Curso ........ ', s.achievement?.name ?? '—')
console.log('  Carga horária  ', s.achievement?.creditsAvailable ?? '—', 'horas')
console.log('  Código ....... ', t.codigoValidacao ?? '—')
console.log('  Emitido em ... ', vc.validFrom ?? '—')
console.log('  Emissor ...... ', vc.issuer?.name ?? '—')

if (t.revogado) {
  console.log('\n  ⚠ Esta credencial foi emitida JÁ MARCADA COMO REVOGADA.')
} else {
  console.log('\n  Obs.: a assinatura não prova que o certificado não foi revogado')
  console.log('        depois de emitido. Para isso, consulte:', t.verificacaoOnline ?? '—')
}
console.log('')
