import { VerifyEmailView } from '@/components/auth/verify-email-view'

// /verify-email/expired — shown when a verification link is invalid, used, or
// expired. Offers a resend.
export default function VerifyEmailExpiredPage() {
  return <VerifyEmailView mode="expired" />
}
