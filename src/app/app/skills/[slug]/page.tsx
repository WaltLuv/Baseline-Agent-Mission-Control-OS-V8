import { Suspense } from 'react'
import { SkillDetailView } from '@/components/baseline-os/skill-detail-view'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function SkillPage({ params }: Props) {
  const { slug } = await params
  return (
    <Suspense fallback={null}>
      <div className="mx-auto max-w-4xl p-4">
        <SkillDetailView slug={slug} />
      </div>
    </Suspense>
  )
}
