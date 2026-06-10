/**
 * Prompt Library — 100+ battle-tested prompts for your AI agent stack.
 * Midnight Aubergine palette · amber/gold (#F59E0B) · dopamine-inducing.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search,
  Copy,
  Star,
  Zap,
  Save,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { VoiceInput } from "@/components/voice-input";
import { cn } from "@/lib/utils";

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/prompts")({
  head: () => ({
    meta: [
      { title: "Prompt Library — Baseline Automations" },
      { name: "description", content: "100+ battle-tested prompts for your AI agent stack." },
    ],
  }),
  component: PromptsPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

type Category =
  | "All"
  | "Baseline Automations"
  | "Gemini Flash"
  | "Antigravity"
  | "Subagents"
  | "Business"
  | "Content"
  | "SEO"
  | "Community"
  | "Strategy"
  | "Technical"
  | "Power User"
  | "Favorites";

interface Prompt {
  id: number;
  category: Exclude<Category, "All" | "Favorites">;
  text: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "claude-os.prompts.favorites.v1";
const GOLD = "#F59E0B";

const CATEGORY_META: Record<
  Exclude<Category, "All" | "Favorites">,
  { emoji: string; color: string; bg: string }
> = {
  "Baseline Automations":   { emoji: "🖥️",  color: "#F59E0B", bg: "rgba(245,158,11,0.15)" },
  "Gemini Flash": { emoji: "⚡", color: "#A78BFA", bg: "rgba(167,139,250,0.15)" },
  "Antigravity":  { emoji: "🏗️", color: "#34D399", bg: "rgba(52,211,153,0.15)" },
  "Subagents":    { emoji: "🤖", color: "#60A5FA", bg: "rgba(96,165,250,0.15)" },
  "Business":     { emoji: "📊", color: "#F472B6", bg: "rgba(244,114,182,0.15)" },
  "Content":      { emoji: "📝", color: "#FB923C", bg: "rgba(251,146,60,0.15)" },
  "SEO":          { emoji: "🔍", color: "#2DD4BF", bg: "rgba(45,212,191,0.15)" },
  "Community":    { emoji: "💬", color: "#818CF8", bg: "rgba(129,140,248,0.15)" },
  "Strategy":     { emoji: "🎯", color: "#E879F9", bg: "rgba(232,121,249,0.15)" },
  "Technical":    { emoji: "🔧", color: "#94A3B8", bg: "rgba(148,163,184,0.15)" },
  "Power User":   { emoji: "🚀", color: "#F59E0B", bg: "rgba(245,158,11,0.15)" },
};

const FILTER_TABS: Category[] = [
  "All",
  "Favorites",
  "Baseline Automations",
  "Gemini Flash",
  "Antigravity",
  "Subagents",
  "Content",
  "SEO",
  "Business",
  "Strategy",
  "Technical",
  "Community",
  "Power User",
];

// ─── Prompt Data ──────────────────────────────────────────────────────────────

const ALL_PROMPTS: Prompt[] = [
  // Baseline Automations
  { id: 1,  category: "Baseline Automations", text: "Build me a clean dark-mode Baseline Automations dashboard. Save all files to scratch/agent-dashboard/." },
  { id: 2,  category: "Baseline Automations", text: "Create an Baseline Automations homepage with tabs for: Active Tasks, Completed Work, Files, and Agent Status." },
  { id: 3,  category: "Baseline Automations", text: "Build an Baseline Automations dashboard with a real-time task feed showing what each agent is working on." },
  { id: 4,  category: "Baseline Automations", text: "Create a workspace file viewer that shows every file my agents have created, sorted by newest first." },
  { id: 5,  category: "Baseline Automations", text: "Build a dashboard that lets me launch a new agent task with one click and shows me the output live." },
  { id: 6,  category: "Baseline Automations", text: "Design an Baseline Automations control panel with sections: Launch Agent, Review Output, Active Queue, Completed." },
  { id: 7,  category: "Baseline Automations", text: "Build a command centre dashboard where I can type one goal and it breaks it into sub-tasks for multiple agents." },
  { id: 8,  category: "Baseline Automations", text: "Create a beautiful agent management interface with cards for each active agent showing: task name, progress, status." },
  { id: 9,  category: "Baseline Automations", text: "Build a daily briefing page that summarises what my agents completed in the last 24 hours." },
  { id: 10, category: "Baseline Automations", text: "Create an Baseline Automations sidebar with quick-launch buttons for my most common agent tasks." },

  // Gemini Flash
  { id: 11, category: "Gemini Flash", text: "Using Gemini 3.5 Flash, research the top 10 trends in [your niche] this week and give me a full report." },
  { id: 12, category: "Gemini Flash", text: "Analyse this document and give me the 5 most important insights I need to act on today." },
  { id: 13, category: "Gemini Flash", text: "Write a detailed step-by-step plan for launching [product/service] in 30 days." },
  { id: 14, category: "Gemini Flash", text: "Compare the top 5 competitors in [niche] and identify the gaps I can exploit." },
  { id: 15, category: "Gemini Flash", text: "Generate 30 days of content ideas based on [topic] for a YouTube channel." },
  { id: 16, category: "Gemini Flash", text: "Research [topic] and write a 2,000-word expert guide in plain English." },
  { id: 17, category: "Gemini Flash", text: "Summarise this 100-page PDF into the 10 most important action points." },
  { id: 18, category: "Gemini Flash", text: "Analyse my last 10 YouTube videos and tell me what's working and what to cut." },
  { id: 19, category: "Gemini Flash", text: "Write me a complete content calendar for [month] based on this offer: [describe offer]." },
  { id: 20, category: "Gemini Flash", text: "Generate a full competitive analysis for [niche] including pricing, positioning, and opportunities." },

  // Antigravity
  { id: 21, category: "Antigravity", text: "Build a beautiful HTML landing page for [offer]. Save it to scratch/landing-page/." },
  { id: 22, category: "Antigravity", text: "Create a multi-section sales page for [product] with hero, benefits, testimonials, and CTA sections." },
  { id: 23, category: "Antigravity", text: "Build a dark-mode membership onboarding page for [community name]." },
  { id: 24, category: "Antigravity", text: "Create a full dashboard for tracking [type of data] with charts and filters." },
  { id: 25, category: "Antigravity", text: "Build a one-page website for [business name] with clean typography and mobile responsiveness." },
  { id: 26, category: "Antigravity", text: "Create a pricing page for [offer] with 3 tiers. Make it modern and conversion-focused." },
  { id: 27, category: "Antigravity", text: "Build an FAQ page for [business/product] using these questions: [list questions]." },
  { id: 28, category: "Antigravity", text: "Create a checkout confirmation page that includes next steps and a welcome message." },
  { id: 29, category: "Antigravity", text: "Build a resource library page showing guides, prompts, and tutorials with search functionality." },
  { id: 30, category: "Antigravity", text: "Create a weekly scorecard tool where I can input KPIs and see them visualised." },

  // Subagents
  { id: 31, category: "Subagents", text: "Deploy 3 subagents: one to research, one to write, one to format. Goal: create a complete guide on [topic]." },
  { id: 32, category: "Subagents", text: "Use parallel agents to research, outline, and draft a YouTube script on [topic]." },
  { id: 33, category: "Subagents", text: "Run subagents to: (1) scrape top Reddit threads on [topic], (2) summarise key pain points, (3) write a content brief." },
  { id: 34, category: "Subagents", text: "Deploy agents to build a full email sequence: research → outline → write → format." },
  { id: 35, category: "Subagents", text: "Use 2 agents in parallel: one builds the HTML, one writes the copy. Goal: landing page for [offer]." },
  { id: 36, category: "Subagents", text: "Run an agent to analyse [dataset] and a second agent to turn the insights into a presentation." },
  { id: 37, category: "Subagents", text: "Deploy subagents to: research 5 competitors, extract their hooks, and write 20 better versions." },
  { id: 38, category: "Subagents", text: "Use 3 agents to produce a YouTube video: (1) research, (2) script, (3) thumbnail concept." },
  { id: 39, category: "Subagents", text: "Run parallel agents to audit my current content: what's getting traffic, what's dead, and what to double down on." },
  { id: 40, category: "Subagents", text: "Deploy agents to build my entire lead magnet: cover design, content, and delivery page." },

  // Business
  { id: 41, category: "Business", text: "Audit my sales process and find the 3 biggest leaks." },
  { id: 42, category: "Business", text: "Build a weekly operations report template I can fill out in under 10 minutes." },
  { id: 43, category: "Business", text: "Create an SOP for onboarding new team members to use AI agents." },
  { id: 44, category: "Business", text: "Write a weekly KPI tracker for my business with the 5 most important metrics." },
  { id: 45, category: "Business", text: "Create a project management dashboard for managing 3 active campaigns at once." },
  { id: 46, category: "Business", text: "Build a client reporting template that pulls together results from multiple channels." },
  { id: 47, category: "Business", text: "Write a complete SOP for how to use Antigravity to build a landing page from scratch." },
  { id: 48, category: "Business", text: "Create a team briefing document format for weekly AI operations review meetings." },
  { id: 49, category: "Business", text: "Write a process document for reviewing and approving agent-generated content." },
  { id: 50, category: "Business", text: "Build a quality control checklist for any content produced by AI agents." },

  // Content
  { id: 51, category: "Content", text: "Write a YouTube script on [topic] using the 'DESTROYS' title format for maximum views." },
  { id: 52, category: "Content", text: "Create 10 YouTube titles using the 'FREE X vs PAID Y' format for [niche]." },
  { id: 53, category: "Content", text: "Write a short-form video script (60 seconds) breaking down Gemini 3.5 Flash for beginners." },
  { id: 54, category: "Content", text: "Generate 30 YouTube thumbnail text ideas for [topic] that create curiosity and urgency." },
  { id: 55, category: "Content", text: "Write a hook-driven intro for a YouTube video about AI agents (first 30 seconds only)." },
  { id: 56, category: "Content", text: "Create a viral-style post for [platform] about [new AI update] written for a general audience." },
  { id: 57, category: "Content", text: "Write 10 email subject lines for a campaign about [topic]." },
  { id: 58, category: "Content", text: "Generate a blog post outline for [keyword] with 8 sections and sub-bullets for each." },
  { id: 59, category: "Content", text: "Write 3 different opening hooks for a video about [topic]. Make each one impossible to skip." },
  { id: 60, category: "Content", text: "Create a 7-day email nurture sequence for someone who just opted in to [lead magnet]." },

  // SEO
  { id: 61, category: "SEO", text: "Research the top 20 questions people ask about [topic] and rank them by search intent." },
  { id: 62, category: "SEO", text: "Write a complete SEO article for the keyword '[keyword]' with H1, H2s, and meta description." },
  { id: 63, category: "SEO", text: "Analyse the top 5 ranking articles for '[keyword]' and tell me what they're missing." },
  { id: 64, category: "SEO", text: "Create an internal linking plan for a site about [topic] with 10 pillar pages." },
  { id: 65, category: "SEO", text: "Build a keyword cluster for [niche] with 50 keywords grouped by topic." },
  { id: 66, category: "SEO", text: "Write a featured snippet answer for the question: [question]." },
  { id: 67, category: "SEO", text: "Create a content brief for a writer targeting [keyword] including word count, headings, and key points." },
  { id: 68, category: "SEO", text: "Research the top backlink opportunities for a site in [niche]." },
  { id: 69, category: "SEO", text: "Write a comparison article: [Tool A] vs [Tool B] — which is better for [use case]." },
  { id: 70, category: "SEO", text: "Create 10 long-tail keyword variations of '[core keyword]' optimised for voice search." },

  // Community
  { id: 71, category: "Community", text: "Write a welcome message for a new member joining an AI community." },
  { id: 72, category: "Community", text: "Create a 30-day challenge structure for members to implement AI agents in their business." },
  { id: 73, category: "Community", text: "Write 10 community engagement posts that spark discussion about AI tools." },
  { id: 74, category: "Community", text: "Create a member milestone celebration post for someone who just achieved [result]." },
  { id: 75, category: "Community", text: "Write an FAQ document for a new AI-focused membership community." },
  { id: 76, category: "Community", text: "Generate 30 daily tips for a membership community focused on AI and productivity." },
  { id: 77, category: "Community", text: "Create a feedback survey for community members with 5 key questions." },
  { id: 78, category: "Community", text: "Write a re-engagement email for members who haven't logged in for 2 weeks." },
  { id: 79, category: "Community", text: "Create a 'Quick Win' guide for new members: 5 things to do in the first 48 hours." },
  { id: 80, category: "Community", text: "Build a member onboarding sequence: 7 emails over 7 days, each covering one AI tool." },

  // Strategy
  { id: 81, category: "Strategy", text: "Build a 90-day content strategy for growing a YouTube channel in [niche]." },
  { id: 82, category: "Strategy", text: "Create a launch plan for a new digital product. Budget: minimal. Timeline: 30 days." },
  { id: 83, category: "Strategy", text: "Write a positioning statement for [business] that stands out from every competitor." },
  { id: 84, category: "Strategy", text: "Build a lead generation plan using AI agents as the primary content creation engine." },
  { id: 85, category: "Strategy", text: "Create a traffic strategy for a new website in [niche] using only organic channels." },
  { id: 86, category: "Strategy", text: "Write a 12-month roadmap for scaling [business type] using AI-first operations." },
  { id: 87, category: "Strategy", text: "Build a go-to-market plan for [product] targeting [audience] with [budget]." },
  { id: 88, category: "Strategy", text: "Create an offer stack for [business] with a free lead magnet, core offer, and upsell." },
  { id: 89, category: "Strategy", text: "Write a positioning document: how is [my business] different from every alternative?" },
  { id: 90, category: "Strategy", text: "Build a weekly review system to track the impact of AI agent work on my business." },

  // Technical
  { id: 91,  category: "Technical", text: "Set up an Antigravity workflow that takes a YouTube URL and produces a full content brief." },
  { id: 92,  category: "Technical", text: "Build an agent pipeline: input = blog URL, output = 10 social posts formatted for each platform." },
  { id: 93,  category: "Technical", text: "Create an agent that reads a PDF and produces a bullet-point summary under 200 words." },
  { id: 94,  category: "Technical", text: "Set up a multi-step agent workflow for producing a YouTube video from idea to script." },
  { id: 95,  category: "Technical", text: "Build an agent that monitors [topic] and sends me a weekly digest of the most important updates." },
  { id: 96,  category: "Technical", text: "Create an agent that takes a transcript and turns it into a formatted blog post with SEO metadata." },
  { id: 97,  category: "Technical", text: "Build a research agent that compiles a competitor analysis report from scratch." },
  { id: 98,  category: "Technical", text: "Set up an agent workflow: input = one topic, output = 7 YouTube titles, a script outline, and 5 thumbnail concepts." },
  { id: 99,  category: "Technical", text: "Create an agent that audits any landing page and gives a conversion optimisation score out of 10." },
  { id: 100, category: "Technical", text: "Build an agent that turns any rough notes into a formatted, ready-to-publish guide." },

  // Power User
  { id: 101, category: "Power User", text: "Build a fully automated content machine: topic in → YouTube script + blog post + 5 social posts out." },
  { id: 102, category: "Power User", text: "Create a self-improving agent that reviews its own output, critiques it, and rewrites it to a higher standard." },
  { id: 103, category: "Power User", text: "Deploy a swarm of 5 agents: researcher, writer, editor, designer brief, and SEO analyst — all on one topic." },
  { id: 104, category: "Power User", text: "Build an agent that learns from my past content, identifies my voice, and generates new content that sounds exactly like me." },
  { id: 105, category: "Power User", text: "Create an AI-powered weekly business review: ingests KPIs, flags issues, and prescribes this week's top 3 priorities." },
  { id: 106, category: "Power User", text: "Build a multi-agent system that monitors 10 competitors and alerts me to any major moves within 24 hours." },
  { id: 107, category: "Power User", text: "Deploy an agent that takes any sales call transcript and produces: objection map, follow-up email, and deal probability score." },
  { id: 108, category: "Power User", text: "Create an agent pipeline that converts any course idea into: outline, module scripts, worksheets, and a sales page — in one run." },
  { id: 109, category: "Power User", text: "Build a 'second brain' agent that indexes everything I've ever written and can answer questions about my own knowledge." },
  { id: 110, category: "Power User", text: "Deploy a recursive agent loop: generate → critique → improve → repeat until quality score exceeds 9/10. Output the final version." },

  // ─── 115 Prompt Bible for Baseline Automations (Mission Control workflow) ───────────
  // Appended 2026-05-29. Mapped to existing categories; the bracketed tags
  // [Mission Control], [Goals], [Journal], [Memory], [Workflow], [Maintenance]
  // are preserved in the prompt text so users can still search by them.
  // De-duped against ids 1-110 above before adding.

  // Mission Control & System (1–10)
  { id: 111, category: "Baseline Automations", text: "[Mission Control] You have access to my Obsidian vault. Read my last 7 journal entries and give me a summary of what I've been focused on and what patterns you notice." },
  { id: 112, category: "Baseline Automations", text: "[Mission Control] Check my current goals. Which ones am I making the least progress on? What's the most likely reason and what's one action I can take today?" },
  { id: 113, category: "Baseline Automations", text: "[Mission Control] Search my memory vault for every conversation we've had about [topic]. Summarise the key decisions I've made and what I concluded." },
  { id: 114, category: "Baseline Automations", text: "[Mission Control] Read my journal from the last 30 days and give me a sentiment analysis. Am I trending towards more clarity and momentum, or more stress and confusion?" },
  { id: 115, category: "Baseline Automations", text: "[Mission Control] Cross-reference my current goals with my recent journal entries. Am I actually spending my time on what I said matters most?" },
  { id: 116, category: "Baseline Automations", text: "[Mission Control] Search my vault for any notes on [competitor/topic/person]. Compile everything you find into one clean briefing document." },
  { id: 117, category: "Baseline Automations", text: "[Mission Control] Write a new journal entry on my behalf based on what I tell you about my day: [paste summary]. Format it the way my previous entries are structured." },
  { id: 118, category: "Baseline Automations", text: "[Mission Control] Review my goals and generate a weekly focus brief. For each goal, give me one concrete action I should take this week." },
  { id: 119, category: "Baseline Automations", text: "[Mission Control] Search my memory for the last time I worked on [project]. What stage was I at and what was the next step?" },
  { id: 120, category: "Baseline Automations", text: "[Mission Control] Based on everything in my vault, write a 'State of the Business' summary as if you were a chief of staff briefing me before a strategy session." },

  // Claude Control Room (11–25)
  { id: 121, category: "Power User", text: "[Control Room] Act as a senior SEO strategist. Analyse this website: [URL]. Give me the top 10 opportunities to increase organic traffic in 90 days." },
  { id: 122, category: "Power User", text: "[Control Room] Read this document: [paste or attach]. Summarise it, identify the 3 most important points, and flag anything that needs a decision from me." },
  { id: 123, category: "Power User", text: "[Control Room] Write a YouTube script for the title: [title]. Punchy, fast, 3rd grade reading level. Hook in the first 5 seconds." },
  { id: 124, category: "Power User", text: "[Control Room] Give me 20 YouTube title ideas for a video about [topic]. Prioritise formats that get 10K+ views: free tool comparisons, Google Antigravity, or NotebookLM combos." },
  { id: 125, category: "Power User", text: "[Control Room] I need to write a response to this community post: [paste post]. Keep it under 3 sentences. Natural, direct, no dashes, no 'mate'." },
  { id: 126, category: "Power User", text: "[Control Room] Review this sales page: [paste]. Rate each section 1-10. Rewrite the headline and opening paragraph." },
  { id: 127, category: "Power User", text: "[Control Room] Write a 5-email onboarding sequence for someone who just joined my community. Warm, action-focused, one quick win per email." },
  { id: 128, category: "Power User", text: "[Control Room] Act as my content strategist. Based on my channel's best-performing video formats, give me a 30-day content calendar." },
  { id: 129, category: "Power User", text: "[Control Room] Write a first draft of a link building outreach email targeting [type of site] in the [niche] space. Short, not spammy, clear value." },
  { id: 130, category: "Power User", text: "[Control Room] Analyse this transcript: [paste]. Pull out the top 5 insights and turn them into a bullet-point summary I can post in my community." },
  { id: 131, category: "Power User", text: "[Control Room] Write a content brief for an article targeting the keyword: [keyword]. Include H2 structure, word count recommendation, and top 3 points to cover." },
  { id: 132, category: "Power User", text: "[Control Room] Draft a Skool community post about [topic]. Every sentence on a new line. Plain, direct, no emojis unless natural." },
  { id: 133, category: "Power User", text: "[Control Room] I have [X minutes] to review my business. What are the 5 highest-leverage questions I should be asking myself?" },
  { id: 134, category: "Power User", text: "[Control Room] Write a follow-up email for a prospect who watched our sales call but hasn't signed. Confident, no desperation, clear next step." },
  { id: 135, category: "Power User", text: "[Control Room] Help me build a context document for my AI agents. Ask me the questions you'd need answered to understand my business fully." },

  // Hermes Agent Task (26–35)
  { id: 136, category: "Subagents", text: "[Hermes] Search the web for the top 10 articles ranking for [keyword]. For each one, list: title, URL, word count estimate, and the main angle they take." },
  { id: 137, category: "Subagents", text: "[Hermes] Find the most-shared content about [topic] in the last 30 days. What angles are getting traction?" },
  { id: 138, category: "Subagents", text: "[Hermes] Research [competitor]. What are their top pages by traffic? What topics are they dominating that I haven't covered?" },
  { id: 139, category: "Subagents", text: "[Hermes] Find 10 high-authority websites in the [niche] space that accept guest posts. List domain rating, contact page URL, and submission requirements." },
  { id: 140, category: "Subagents", text: "[Hermes] Search for the latest news about [AI tool/topic] from the past 7 days. Write a summary I can turn into a YouTube video." },
  { id: 141, category: "Subagents", text: "[Hermes] Pull the top 20 YouTube videos for the search term [keyword]. List title, channel, view count, and upload date." },
  { id: 142, category: "Subagents", text: "[Hermes] Research the pricing pages of these 5 competitors: [list]. What does each offer at each price point? Where are the gaps?" },
  { id: 143, category: "Subagents", text: "[Hermes] Find recent Reddit threads about [topic/pain point]. What are people complaining about most? What solutions are they looking for?" },
  { id: 144, category: "Subagents", text: "[Hermes] Search for case studies about [topic] published in the last 6 months. Summarise the key results and methodologies." },
  { id: 145, category: "Subagents", text: "[Hermes] Go to [URL] and extract: every service listed, every CTA used, and the main headline on each page." },

  // Goals Layer (36–45)
  { id: 146, category: "Strategy", text: "[Goals] My current goals are: [list]. Help me write a 90-day sprint plan with weekly milestones for each one." },
  { id: 147, category: "Strategy", text: "[Goals] I've been working on [goal] for [time]. Based on my progress, am I on track? What's the most likely bottleneck?" },
  { id: 148, category: "Strategy", text: "[Goals] Help me set a new goal using the SMART framework for: [vague goal]. Make it specific, measurable, and realistic for my situation." },
  { id: 149, category: "Strategy", text: "[Goals] Review my goals and tell me which one, if completed, would have the biggest knock-on effect on all the others." },
  { id: 150, category: "Strategy", text: "[Goals] I'm feeling scattered across too many goals. Help me identify which 1-3 to focus on exclusively for the next 30 days." },
  { id: 151, category: "Strategy", text: "[Goals] Write a weekly review template I can use every Friday to track goal progress, celebrate wins, and reset priorities." },
  { id: 152, category: "Strategy", text: "[Goals] Based on my goals, design a daily non-negotiable task list. What must I do every single day for these goals to become reality?" },
  { id: 153, category: "Strategy", text: "[Goals] I've hit [goal milestone]. Help me write a community post celebrating this win in a way that also inspires my members." },
  { id: 154, category: "Strategy", text: "[Goals] Stress-test my goals. For each one, tell me the most likely reason I'll fail to hit it — and what I can do now to prevent that." },
  { id: 155, category: "Strategy", text: "[Goals] Based on what I've accomplished this quarter, what should my goals be for next quarter?" },

  // Journal Layer (46–50)
  { id: 156, category: "Strategy", text: "[Journal] I want to start journalling in Obsidian. Create a daily journal template that takes under 5 minutes to fill in but captures what matters." },
  { id: 157, category: "Strategy", text: "[Journal] Read my last journal entry: [paste or attach]. What emotions are coming through? What decision seems to be weighing on me most?" },
  { id: 158, category: "Strategy", text: "[Journal] I want to do a weekly review journal entry. Ask me 5 questions I should answer every Sunday to close out the week properly." },
  { id: 159, category: "Strategy", text: "[Journal] Help me write a journal entry about a difficult decision I'm facing: [describe situation]. Help me think it through to a clear position." },
  { id: 160, category: "Strategy", text: "[Journal] Write a 'year in review' journal template I can fill in every December. Cover growth, lessons, relationships, and what I want to leave behind." },

  // Memory Layer (51–55)
  { id: 161, category: "Strategy", text: "[Memory] Search my conversation history for every time I've discussed [topic]. Compile the key decisions and directions I've taken." },
  { id: 162, category: "Strategy", text: "[Memory] I remember making a decision about [topic] but can't recall the details. Search my memory for anything related." },
  { id: 163, category: "Strategy", text: "[Memory] Summarise the last 10 conversations we had. What themes are recurring? What am I clearly prioritising?" },
  { id: 164, category: "Strategy", text: "[Memory] Search my vault for any notes tagged with [tag or keyword]. Compile them into a master document." },
  { id: 165, category: "Strategy", text: "[Memory] I want to brief a new team member on [topic]. Search my memory and vault and compile everything relevant into a clear briefing document." },

  // Multi-Agent Workflow (56–65)
  { id: 166, category: "Subagents", text: "[Workflow] Design a content production workflow that uses Claude for scripting and Hermes Agent for research — for a daily YouTube channel." },
  { id: 167, category: "Subagents", text: "[Workflow] Create a daily agent task list. What should Claude handle every morning? What should Hermes Agent run overnight?" },
  { id: 168, category: "Subagents", text: "[Workflow] I want to automate my SEO reporting. Design a workflow using Hermes Agent to pull data and Claude to compile and interpret it." },
  { id: 169, category: "Subagents", text: "[Workflow] Build a prompt chain for producing one piece of long-form SEO content end to end — from keyword to published article." },
  { id: 170, category: "Subagents", text: "[Workflow] Design a lead outreach automation. Hermes Agent researches prospects. Claude writes personalised messages. Walk me through the full workflow." },
  { id: 171, category: "Subagents", text: "[Workflow] How should I structure my agent roles so Claude and Hermes Agent aren't doing duplicate work?" },
  { id: 172, category: "Subagents", text: "[Workflow] Design an overnight agent workflow for my business. What tasks should be queued before I go to sleep so I wake up to finished work?" },
  { id: 173, category: "Subagents", text: "[Workflow] Create a content repurposing workflow. One YouTube video becomes: 3 short clips, 1 blog post, 5 social posts, 1 community post, 1 email. Map every agent step." },
  { id: 174, category: "Subagents", text: "[Workflow] Help me build a client delivery workflow using agents. From brief to deliverable — where does each agent play a role?" },
  { id: 175, category: "Subagents", text: "[Workflow] Design a weekly market intelligence workflow. What should Hermes Agent monitor every week? What should Claude analyse? What should I review?" },

  // Maintenance & Health (66–70)
  { id: 176, category: "Technical", text: "[Maintenance] Walk me through what to do when Mission Control shows an agent as DEGRADED." },
  { id: 177, category: "Technical", text: "[Maintenance] What are the most common reasons OpenClaw shows as OFFLINE and how do I fix each one?" },
  { id: 178, category: "Technical", text: "[Maintenance] Help me build a monthly Baseline Automations audit checklist. What should I review, update, and retire every 30 days?" },
  { id: 179, category: "Technical", text: "[Maintenance] I want to update my agents after a major change in my business. What context should I update and where?" },
  { id: 180, category: "Technical", text: "[Maintenance] Design a disaster recovery plan for my Baseline Automations. If my machine crashes, how do I get back to full operation quickly?" },

  // Content & SEO (71–80)
  { id: 181, category: "Content", text: "Write 10 YouTube title variations for [topic] using the FREE X DESTROYS Y format, the Google Antigravity angle, and the NotebookLM combination style." },
  { id: 182, category: "SEO", text: "Give me 50 long-tail keyword ideas for [niche]. Sort by commercial intent — highest first." },
  { id: 183, category: "SEO", text: "Audit this article for SEO: [paste]. Flag thin sections, missing keywords, and internal linking gaps." },
  { id: 184, category: "SEO", text: "Write a meta title and description for these pages: [list]. Title under 60 characters, description under 160." },
  { id: 185, category: "SEO", text: "Create a full content cluster for [main topic]. One pillar page and 10 supporting articles with suggested titles." },
  { id: 186, category: "Content", text: "Write a YouTube video hook for [topic] that stops someone mid-scroll in under 5 seconds." },
  { id: 187, category: "SEO", text: "Give me 30 FAQ questions for the keyword [keyword] formatted as H2 headings for a blog post." },
  { id: 188, category: "Content", text: "Write an introduction paragraph for the keyword [keyword]. Hook them in the first 2 sentences." },
  { id: 189, category: "Content", text: "Rewrite this paragraph at a 6th grade reading level without losing the core message: [paste paragraph]." },
  { id: 190, category: "Content", text: "Give me 5 content angle ideas for [topic] that none of my competitors have covered." },

  // Community & AIPB (81–90)
  { id: 191, category: "Community", text: "Write 10 replies to community posts about [topic]. Under 3 sentences each. Direct, warm, no dashes, every sentence on a new line." },
  { id: 192, category: "Community", text: "Generate 20 discussion post ideas for a community focused on AI tools and business automation." },
  { id: 193, category: "Community", text: "Write a welcome message for a new member of my AI community. Personalised feeling, action-focused, one quick win they can take today." },
  { id: 194, category: "Community", text: "Write a re-engagement message for a member who's been quiet for 30 days. Not pushy. Genuinely caring." },
  { id: 195, category: "Community", text: "Create a 7-day new member onboarding sequence. One message per day. Each one delivers one insight or quick win." },
  { id: 196, category: "Community", text: "Write a community post announcing [new resource/tool/update]. Every sentence on a new line. Excited but grounded." },
  { id: 197, category: "Community", text: "Generate 15 poll ideas I can post in my community this month to spark engagement." },
  { id: 198, category: "Community", text: "Write a community post that breaks down one concept from this guide in plain language." },
  { id: 199, category: "Community", text: "I got a negative or frustrated comment from a member: [paste comment]. Help me write a response that addresses their concern without being defensive." },
  { id: 200, category: "Community", text: "Write a monthly wins post template I can use in my community to celebrate member results." },

  // Advanced OS (91–100)
  { id: 201, category: "Power User", text: "Act as a systems architect. Review my current agent setup: [describe it]. What's missing? What's redundant? What would you add?" },
  { id: 202, category: "Power User", text: "Help me write a system prompt for Claude that gives it full context about my business, voice, and goals — to be used across all sessions." },
  { id: 203, category: "Power User", text: "Design a prompt library structure for my Baseline Automations. How should I organise 100+ prompts so I can find them instantly?" },
  { id: 204, category: "Power User", text: "I want to train Hermes Agent to handle a specific recurring task: [describe task]. Write the full agent brief." },
  { id: 205, category: "Power User", text: "Help me design a quality control check for all AI-generated outputs before they're published or sent." },
  { id: 206, category: "Power User", text: "Write an agent policy document. What can my agents do autonomously? What requires my sign-off? What is off-limits?" },
  { id: 207, category: "Power User", text: "Design a context refresh protocol. How often should I update my agents' knowledge about my business, and what should be in each update?" },
  { id: 208, category: "Power User", text: "Create a new skill brief for Hermes Agent that handles [specific research task] every week automatically." },
  { id: 209, category: "Power User", text: "Help me build a feedback loop into my agent system. How do I capture what worked, what failed, and feed that back in?" },
  { id: 210, category: "Power User", text: "Write a 'State of My OS' monthly report template. What should I review about my agents, my vault, and my results every 30 days?" },

  // Bonus (101–115)
  { id: 211, category: "Content", text: "Write a 'Day in the Life of Mission Control' post I can share to show my audience what this actually looks like in practice." },
  { id: 212, category: "Strategy", text: "Design the ideal morning routine for someone running Baseline Automations. What do they do in the first 20 minutes of their day?" },
  { id: 213, category: "Content", text: "Help me explain what Baseline Automations is to someone who has never heard of it — in under 60 seconds." },
  { id: 214, category: "Content", text: "Write 5 LinkedIn posts about the concept of running a personal AI operating system. Different angles for each." },
  { id: 215, category: "Content", text: "I want to teach my team to use Baseline Automations. Write a simple onboarding guide for someone brand new to all of this." },
  { id: 216, category: "Power User", text: "Generate 20 ideas for new skills or plugins I could add to Hermes Agent to make my OS more powerful." },
  { id: 217, category: "Power User", text: "Help me design a 'digital twin' — a version of me inside my AI OS that can make decisions the way I would. What would it need to know?" },
  { id: 218, category: "Content", text: "Write a breakdown of why local-first AI is better than cloud-first AI for a small business owner." },
  { id: 219, category: "Content", text: "Create a comparison: running your business with Baseline Automations vs without it. What does a typical day look like in each scenario?" },
  { id: 220, category: "Technical", text: "Help me write a guide for my community on how to set up their first Obsidian vault connected to their AI agents." },
  { id: 221, category: "Community", text: "Generate an 'Baseline Automations beginner mistakes' post. What are the top 10 things people get wrong in their first 30 days?" },
  { id: 222, category: "Strategy", text: "Write a vision post: what does a fully optimised personal AI operating system look like in 2 years?" },
  { id: 223, category: "Technical", text: "Design a 'Mission Control review' checklist. What do I check every morning to confirm everything is healthy and running?" },
  { id: 224, category: "Strategy", text: "Help me write a post about the Memory layer. How does having 1,000+ searchable notes change the way your AI operates?" },
  { id: 225, category: "Content", text: "Write a 'why I built Baseline Automations' story post. Personal, honest, showing the before and after of running this system." },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadFavorites(): Set<number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as number[]);
  } catch {
    return new Set();
  }
}

function saveFavorites(favs: Set<number>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...favs]));
}

function buildVaultMarkdown(): string {
  const categories = Object.keys(CATEGORY_META) as Array<
    Exclude<Category, "All" | "Favorites">
  >;
  const lines: string[] = [
    "# Prompt Library",
    "",
    "> 100+ battle-tested prompts for your AI agent stack.",
    "",
  ];
  for (const cat of categories) {
    const meta = CATEGORY_META[cat];
    const prompts = ALL_PROMPTS.filter((p) => p.category === cat);
    lines.push(`## ${meta.emoji} ${cat}`);
    lines.push("");
    prompts.forEach((p, i) => {
      lines.push(`${i + 1}. ${p.text}`);
    });
    lines.push("");
  }
  return lines.join("\n");
}

// ─── Prompt Card ──────────────────────────────────────────────────────────────

interface PromptCardProps {
  prompt: Prompt;
  isFavorite: boolean;
  onToggleFavorite: (id: number) => void;
}

function PromptCard({ prompt, isFavorite, onToggleFavorite }: PromptCardProps) {
  const [copied, setCopied] = useState(false);
  const [flash, setFlash] = useState(false);
  const meta = CATEGORY_META[prompt.category];

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(prompt.text);
      setCopied(true);
      setFlash(true);
      toast.success("✓ Copied!", { duration: 1500 });
      setTimeout(() => setCopied(false), 2000);
      setTimeout(() => setFlash(false), 600);
    } catch {
      toast.error("Copy failed — try selecting the text manually.");
    }
  }, [prompt.text]);

  const handleVoiceTranscript = useCallback(
    (transcript: string) => {
      toast.info(`🎤 "${transcript}" — prompt #${prompt.id}`, { duration: 3000 });
    },
    [prompt.id],
  );

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-3 rounded-xl border p-4 transition-all duration-300 break-inside-avoid mb-4",
        "bg-card border-border/40 hover:border-border hover:shadow-lg",
        flash && "ring-2 ring-offset-1 ring-offset-background",
      )}
      style={flash ? { boxShadow: `0 0 0 2px ${GOLD}60, 0 8px 32px -8px ${GOLD}40` } : undefined}
    >
      {/* Flash overlay */}
      {flash && (
        <div
          className="absolute inset-0 rounded-xl pointer-events-none transition-opacity duration-500"
          style={{ background: `${GOLD}10` }}
        />
      )}

      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        {/* Category badge */}
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold leading-tight"
          style={{ color: meta.color, background: meta.bg }}
        >
          <span>{meta.emoji}</span>
          <span>{prompt.category}</span>
        </span>

        {/* Action buttons */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {/* Favorite */}
          <button
            type="button"
            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
            onClick={() => onToggleFavorite(prompt.id)}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg border transition-all duration-200",
              isFavorite
                ? "border-transparent text-amber-400"
                : "border-border/40 text-muted-foreground hover:text-amber-400 hover:border-amber-400/40",
            )}
            style={isFavorite ? { background: "rgba(245,158,11,0.15)" } : undefined}
          >
            <Star
              className="h-3.5 w-3.5"
              fill={isFavorite ? "currentColor" : "none"}
            />
          </button>

          {/* Voice */}
          <VoiceInput
            onTranscript={handleVoiceTranscript}
            color={GOLD}
            className="[&>div]:h-7 [&>div]:w-7 [&_button]:h-7 [&_button]:w-7 [&_button]:rounded-lg [&_button]:border-border/40"
          />

          {/* Copy */}
          <button
            type="button"
            aria-label="Copy prompt"
            onClick={handleCopy}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-all duration-200",
              copied
                ? "border-transparent text-white"
                : "border-border/40 text-muted-foreground hover:text-foreground hover:border-border",
            )}
            style={copied ? { background: GOLD } : undefined}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {/* Prompt text */}
      <p className="text-sm leading-relaxed text-foreground/90 select-text">
        {prompt.text}
      </p>

      {/* Prompt number */}
      <span className="text-[10px] font-mono text-muted-foreground/40 select-none">
        #{String(prompt.id).padStart(3, "0")}
      </span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function PromptsPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [savingVault, setSavingVault] = useState(false);

  // Load favorites from localStorage
  useEffect(() => {
    setFavorites(loadFavorites());
  }, []);

  const toggleFavorite = useCallback((id: number) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        toast("Removed from favorites", { icon: "☆" });
      } else {
        next.add(id);
        toast.success("Added to favorites", { icon: "★" });
      }
      saveFavorites(next);
      return next;
    });
  }, []);

  // Reset search when category changes
  const handleCategoryChange = useCallback((cat: Category) => {
    setActiveCategory(cat);
    setSearch("");
  }, []);

  // Filter prompts
  const filtered = useMemo(() => {
    let base = ALL_PROMPTS;

    if (activeCategory === "Favorites") {
      base = base.filter((p) => favorites.has(p.id));
    } else if (activeCategory !== "All") {
      base = base.filter((p) => p.category === activeCategory);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      base = base.filter((p) => p.text.toLowerCase().includes(q));
    }

    return base;
  }, [activeCategory, search, favorites]);

  // Save all to vault
  const handleSaveVault = useCallback(async () => {
    setSavingVault(true);
    try {
      const content = buildVaultMarkdown();
      const res = await fetch("/__obsidian_write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "Baseline Automations/Prompt Library.md",
          content,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("✓ Saved to Obsidian vault!", { duration: 3000 });
    } catch (err) {
      toast.error(`Vault write failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setSavingVault(false);
    }
  }, []);

  // Stats
  const totalPrompts = ALL_PROMPTS.length;
  const totalCategories = Object.keys(CATEGORY_META).length;
  const totalFavorites = favorites.size;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ─── HERO ─────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-b border-border/30">
        {/* Gold glow blob */}
        <div
          className="pointer-events-none absolute inset-0 -z-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 50% -10%, rgba(245,158,11,0.18) 0%, transparent 70%)",
          }}
        />
        {/* Subtle grid */}
        <div
          className="pointer-events-none absolute inset-0 -z-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg,transparent,transparent 39px,#fff 39px,#fff 40px),repeating-linear-gradient(90deg,transparent,transparent 39px,#fff 39px,#fff 40px)",
          }}
        />

        <div className="relative z-10 mx-auto max-w-6xl px-6 py-16 sm:py-24">
          {/* Pill badge */}
          <div className="mb-5 flex justify-center">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold"
              style={{
                borderColor: `${GOLD}50`,
                color: GOLD,
                background: `${GOLD}12`,
              }}
            >
              <Zap className="h-3 w-3" fill="currentColor" />
              Agent Stack · 100+ Prompts
            </span>
          </div>

          {/* Title */}
          <h1
            className="mb-4 text-center text-5xl font-black tracking-tight sm:text-6xl"
            style={{
              background: `linear-gradient(135deg, #fff 30%, ${GOLD} 70%, #FBBF24 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            ⚡ Prompt Library
          </h1>

          {/* Subtitle */}
          <p className="mx-auto mb-10 max-w-xl text-center text-base text-muted-foreground sm:text-lg">
            100+ battle-tested prompts for your AI agent stack.{" "}
            <span className="text-foreground/70">Click to copy.</span>
          </p>

          {/* Search + voice */}
          <div className="mx-auto flex max-w-2xl items-center gap-2">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                placeholder="Search 100+ prompts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-border/60 bg-card/80 py-3 pl-10 pr-4 text-sm placeholder:text-muted-foreground/60 focus:border-amber-400/60 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition-all duration-200"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>
            <VoiceInput
              onTranscript={(t) => setSearch(t)}
              color={GOLD}
              className="shrink-0"
            />
            <button
              type="button"
              onClick={handleSaveVault}
              disabled={savingVault}
              title="Save all prompts to Obsidian vault"
              className="flex h-12 shrink-0 items-center gap-2 rounded-xl border border-border/60 bg-card/80 px-4 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-border transition-all duration-200 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              <span className="hidden sm:inline">{savingVault ? "Saving…" : "Vault"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── STATS ROW ────────────────────────────────────────────────────────── */}
      <div className="border-b border-border/20 bg-card/30">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-0 divide-x divide-border/30 px-6 py-4 sm:justify-start">
          {[
            { label: "Prompts",    value: `${totalPrompts}+` },
            { label: "Categories", value: `${totalCategories}` },
            { label: "Free",       value: "Always" },
            { label: "Favorites",  value: `${totalFavorites}` },
            { label: "Voice",      value: "Enabled" },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col items-center px-6 first:pl-0">
              <span
                className="text-2xl font-black tracking-tight"
                style={{ color: GOLD }}
              >
                {value}
              </span>
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── FILTER CHIPS ────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 border-b border-border/20 bg-background/90 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-6 py-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {FILTER_TABS.map((cat) => {
              const isActive = activeCategory === cat;
              const meta = cat !== "All" && cat !== "Favorites"
                ? CATEGORY_META[cat as Exclude<Category, "All" | "Favorites">]
                : null;
              const emoji = cat === "Favorites" ? "★" : cat === "All" ? "✦" : meta?.emoji ?? "";
              const count =
                cat === "All"
                  ? ALL_PROMPTS.length
                  : cat === "Favorites"
                    ? favorites.size
                    : ALL_PROMPTS.filter((p) => p.category === cat).length;

              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleCategoryChange(cat)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all duration-200",
                    isActive
                      ? "border-transparent text-background"
                      : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground",
                  )}
                  style={
                    isActive
                      ? {
                          background: cat === "Favorites"
                            ? GOLD
                            : meta?.color ?? GOLD,
                          borderColor: "transparent",
                        }
                      : {}
                  }
                >
                  <span>{emoji}</span>
                  <span>{cat}</span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0 text-[10px] font-bold",
                      isActive ? "bg-black/20 text-white/80" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── GRID ─────────────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Results meta */}
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {filtered.length === 0 ? (
              "No prompts found"
            ) : (
              <>
                <span className="font-semibold text-foreground">{filtered.length}</span>
                {" "}prompt{filtered.length !== 1 ? "s" : ""}
                {search && (
                  <>
                    {" for "}
                    <span className="font-semibold" style={{ color: GOLD }}>
                      "{search}"
                    </span>
                  </>
                )}
              </>
            )}
          </p>
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
            >
              Clear search
            </button>
          )}
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div
              className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
              style={{ background: `${GOLD}15` }}
            >
              {activeCategory === "Favorites" ? "★" : "🔍"}
            </div>
            <h3 className="mb-2 text-lg font-semibold text-foreground">
              {activeCategory === "Favorites"
                ? "No favorites yet"
                : "No prompts found"}
            </h3>
            <p className="max-w-xs text-sm text-muted-foreground">
              {activeCategory === "Favorites"
                ? "Star a prompt to save it here for quick access."
                : "Try a different search term or browse all categories."}
            </p>
            {activeCategory === "Favorites" && (
              <button
                type="button"
                onClick={() => handleCategoryChange("All")}
                className="mt-4 rounded-xl border px-4 py-2 text-sm font-medium transition-colors hover:border-border"
                style={{ borderColor: `${GOLD}50`, color: GOLD }}
              >
                Browse all prompts
              </button>
            )}
          </div>
        )}

        {/* Masonry grid */}
        {filtered.length > 0 && (
          <div
            className="gap-4"
            style={{
              columnCount: 1,
              columnGap: "1rem",
            }}
          >
            <style>{`
              @media (min-width: 640px) {
                .prompts-masonry { column-count: 2 !important; }
              }
              @media (min-width: 1024px) {
                .prompts-masonry { column-count: 3 !important; }
              }
            `}</style>
            <div className="prompts-masonry gap-4" style={{ columnCount: 1, columnGap: "1rem" }}>
              {filtered.map((prompt) => (
                <PromptCard
                  key={prompt.id}
                  prompt={prompt}
                  isFavorite={favorites.has(prompt.id)}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── FOOTER CTA ───────────────────────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div className="border-t border-border/20 bg-card/20 py-12">
          <div className="mx-auto max-w-xl px-6 text-center">
            <p className="mb-4 text-sm text-muted-foreground">
              Save all {ALL_PROMPTS.length} prompts to your Obsidian vault for offline access.
            </p>
            <button
              type="button"
              onClick={handleSaveVault}
              disabled={savingVault}
              className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-background transition-all duration-200 hover:opacity-90 active:scale-95 disabled:opacity-60"
              style={{ background: `linear-gradient(135deg, ${GOLD}, #FBBF24)` }}
            >
              <Save className="h-4 w-4" />
              {savingVault ? "Saving to vault…" : "Save all to Obsidian vault"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
