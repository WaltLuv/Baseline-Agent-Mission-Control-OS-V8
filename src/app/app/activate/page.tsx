import { ActivationHub } from '@/components/activation/activation-hub'

/**
 * `/app/activate` — three-step activation hub. Customer lands here after
 * /onboarding completes (workspace + AI employees + skills + starter task
 * are already provisioned at that point). Hub guides them through:
 *   1. ✓ System installed (already done)
 *   2. Connect a runtime
 *   3. Invite team
 */
export default function ActivatePage() {
  return <ActivationHub />
}
