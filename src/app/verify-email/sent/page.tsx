import { VerifyEmailView } from '@/components/auth/verify-email-view'

// /verify-email/sent — confirmation shown right after a verification email is
// (re)sent.
export default function VerifyEmailSentPage() {
  return <VerifyEmailView mode="sent" />
}
