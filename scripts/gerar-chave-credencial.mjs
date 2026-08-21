// Gera o par de chaves usado para assinar as credenciais.
//
//   node scripts/gerar-chave-credencial.mjs
//
// Copie o valor de CREDENCIAL_CHAVE_PRIVADA para as variáveis de ambiente da
// Vercel (Settings -> Environment Variables) e guarde uma cópia no mesmo cofre
// onde ficam as credenciais do projeto.
//
// IMPORTANTE: se esta chave for perdida, as credenciais já emitidas continuam
// verificáveis (a chave pública é o que importa para verificar) — mas as novas
// serão assinadas por outra chave, e quem guardou a antiga precisará das duas.
// Trocar de chave sem necessidade só cria trabalho.

import { generateKeyPairSync } from 'node:crypto'

const { privateKey, publicKey } = generateKeyPairSync('ed25519')

const priv = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
const jwk = publicKey.export({ format: 'jwk' })

console.log('\n=== CREDENCIAL_CHAVE_PRIVADA (variável de ambiente) ===\n')
console.log(priv.trim().replace(/\n/g, '\\n'))
console.log('\n=== chave pública, publicada em /emissor/chaves ===\n')
console.log(JSON.stringify({ ...jwk, alg: 'EdDSA', use: 'sig', kid: 'chave-1' }, null, 2))
console.log('')
