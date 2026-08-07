import { Suspense } from 'react'
import LoginForms from './LoginForms'

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Carregando...</p>}>
      <LoginForms />
    </Suspense>
  )
}
