import { WorkforceActivationSequence } from '@/components/activation/workforce-activation-sequence'

/**
 * Workforce Activation route — `/app/activate`.
 *
 * Drop the operator here right after onboarding completes (or via a manual
 * "Activate workforce" CTA) for the cinematic bring-online sequence. After
 * ~8 seconds the sequence routes them into `/app/overview`.
 */
export default function ActivatePage() {
  return <WorkforceActivationSequence />
}
