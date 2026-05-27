'use client'

import { ChatWorkspace } from '@/components/chat/chat-workspace'

export function ChatPagePanel() {
  return (
    <div className="m-4 space-y-3">
      <div data-testid="panel-story-chat" className="rounded-lg border border-border/60 bg-card/20 p-3">
        <h2 className="text-base font-semibold text-foreground">Conversational Workforce</h2>
        <p className="mt-0.5 text-xs text-muted-foreground max-w-2xl">
          Story: a single chat surface to instruct your AI workforce — assign work, ask questions, approve actions. The fastest way to get the workforce moving without opening another panel.
        </p>
      </div>
      <div className="h-[calc(100vh-12rem)] min-h-[480px] overflow-hidden rounded-lg border border-border bg-card">
        <ChatWorkspace mode="embedded" />
      </div>
    </div>
  )
}
