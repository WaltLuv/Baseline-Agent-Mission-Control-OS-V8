'use client'

/**
 * Slim Charles page — the conversational + voice surface for the workforce.
 *
 * Two tabs: Chat (text) and Voice (the Oracle Control System). Voice is the
 * Jarvis-style concept; the product name is Slim Charles.
 */
import { useState } from 'react'
import { ChatWorkspace } from '@/components/chat/chat-workspace'
import { SlimCharlesVoice } from '@/components/voice/slim-charles-voice'

type Tab = 'chat' | 'voice'

export function SlimCharlesPanel() {
  const [tab, setTab] = useState<Tab>('chat')

  return (
    <div className="m-4 space-y-3" data-testid="slim-charles-panel">
      <div className="rounded-lg border border-border/60 bg-card/20 p-3">
        <h1 className="text-base font-semibold text-foreground">Slim Charles</h1>
        <p className="mt-0.5 text-xs text-muted-foreground max-w-2xl">
          Your conversational workforce — instruct by text in Chat, or talk to Slim live in Voice. Slim drives the real Hermes agent with your full skill and tool registry.
        </p>
        <div className="mt-3 flex gap-1">
          {(['chat', 'voice'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              data-testid={`slim-tab-${t}`}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === t ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-secondary'}`}
            >
              {t === 'chat' ? 'Chat' : 'Voice'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'chat' ? (
        <div className="h-[calc(100vh-14rem)] min-h-[480px] overflow-hidden rounded-lg border border-border bg-card">
          <ChatWorkspace mode="embedded" />
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card p-4">
          <SlimCharlesVoice />
        </div>
      )}
    </div>
  )
}
