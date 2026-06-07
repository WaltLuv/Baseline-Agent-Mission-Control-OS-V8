import { VerifyEmailView } from '@/components/auth/verify-email-view'

// /verify-email — the "Verify your email to continue" pending page. Where new
// signups land; sensitive features stay locked until verification.
export default function VerifyEmailPage() {
  return <VerifyEmailView mode="pending" />
}
