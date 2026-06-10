# Instructor Guide — Baseline Automations

> For anyone teaching this course: cohort leads, workshop instructors, TAs, corporate trainers.

---

## The teacher's promise

You are *not* the expert who has memorized every line of the codebase. You are the lead operator who runs this OS daily and shows students how you actually work with it.

The best moments in class are when a student asks something you don't immediately know the answer to and you say: "Let's open the source together." That models the most important skill of the course: **agentic debugging — using the agents to understand the agents.**

---

## Teaching philosophy

| Do | Don't |
|---|---|
| Open the source on screen, scroll while you talk | Read slides at students |
| Run live demos that occasionally fail | Pre-record everything |
| Ask the agents questions in front of students | Pretend you've memorized the answer |
| Let students debug their own laptops | Solve their problems for them |
| Cite the line number in the file | Wave at concepts abstractly |

---

## Per-week instructor notes

These augment each week's lesson plan (`weeks/week-XX.md`). They're the *behind-the-scenes* tips for teaching the week well.

### Week 1
- **Most failed labs:** port conflicts (someone has 8081 in use); `bun: command not found` (shell didn't reload).
- **Demo tip:** open `vite.config.ts` AND the browser at `localhost:8081` side-by-side. Show edit → save → instant HMR.
- **The "aha":** when they see /__vitals refresh in real-time. Open `/` and let it pulse.

### Week 2
- **Most failed labs:** Triad credit errors. Have them top up OpenRouter to $20 *before* lecture.
- **Demo tip:** the 4-agent shootout with a question you've answered before. Compare on a slide.
- **The "aha":** when Gemma 4 (free, local) outputs better-than-expected on a basic task. Frame this as: "you don't need to pay every time you ask a question."

### Week 3
- **Most failed labs:** persona doesn't fire (summon phrase too generic; YAML indentation off).
- **Demo tip:** edit `slim-charles.yaml` live, restart, show the new behavior fire. Then revert in front of them.
- **The "aha":** they realize the 6 layers map to "how I'd brief a new hire."

### Week 4
- **Most failed labs:** Pinecone index dimensions wrong (must be 1024 for `multilingual-e5-large`).
- **Demo tip:** seed a memory, then deliberately query with different *words* but the *same meaning*. The semantic match is the "magic moment."
- **The "aha":** Notion + Obsidian + Pinecone as redundant memory ≠ duplicated effort. They're different brains for different recall types.

### Week 5
- **Most failed labs:** missing `---` close terminator in frontmatter; install-skills.ts doesn't find their skill.
- **Demo tip:** show `_DUPLICATES.json` for a copy-paste test. Dedup is satisfying.
- **The "aha":** "I can build a skill in 5 minutes and 230 other ones already exist."

### Week 6
- **Most failed labs:** persona scores 0 on "Goal-Driven" because they don't end the prompt with a verifiable criterion.
- **Demo tip:** give the same task to a non-Karpathy persona vs a Karpathy-compliant one. The compliant one asks the clarifying question that saves an hour of wrong work.
- **The "aha":** the four principles are *constraints that increase quality*. Constraints feel like a tax until you see the output.

### Week 7
- **Most failed labs:** /standup runs only the first agent then stops. OpenRouter rate-limited mid-stream.
- **Demo tip:** pick a topic students genuinely disagree on. The disagreement is the lesson.
- **The "aha":** agents productively *disagree*. They're not echo chambers of each other.

### Week 8
- **Most failed labs:** Critic agrees with everything. The Critic prompt was over-written.
- **Demo tip:** Triad a decision that has a clear gut answer and a non-obvious actual answer. Show the Critic surfacing the non-obvious.
- **The "aha":** $0.50 of Triad time can save a $5k mistake.

### Week 9
- **Most failed labs:** tunnel URL is HTTP not HTTPS (Claude Desktop rejects); HERMES_API_KEY env var has trailing newline.
- **Demo tip:** budget the full 90 min for live setup. Some students will need 1:1 debug.
- **The "aha":** Claude *executes* the test prompt rather than describing it. That's a visceral moment.

### Week 10
- **Most failed labs:** Higgsfield CLI not installed; device-flow code expired.
- **Demo tip:** pick a brief students will recognize (their own brand, or a famous campaign to remake).
- **The "aha":** Gemini's orchestration is *better than* a creative director on first draft. Not better than the best human. Better than the median.

### Week 11
- **Most failed labs:** NotebookLM auth on Python 3.13+ (rookiepy doesn't build). Make sure students use Python 3.12.
- **Demo tip:** ask NotebookLM a question only your own notebooks could answer. The citation is the win.
- **The "aha":** "These three surfaces just made my next 10 hours of work disappear."

### Week 12
- **Most failed labs:** students build *too big*. Reign them in.
- **Demo tip:** show 2-3 past capstones on screen. Students model their scope to fit.
- **The "aha":** "I just built something that runs on my computer and solves my actual problem."

---

## Pacing & cadence

For the **cohort tier** (90-min weekly call):

| Minutes | What |
|---|---|
| 0-5 | Wins from last week — 2-3 students share |
| 5-65 | Live lecture (follow the per-week file) |
| 65-80 | Q&A from chat |
| 80-90 | Next week preview + pre-class reading |

Record every session. Post within 24 hours. Indexed by week for searchability.

## Office hours

- Weekly 1-hour group call, separate from the live lecture
- TAs (former students) lead these
- Single-issue focus: pick the one most common problem from the week and solve it live

## Handling difficulty spikes

Weeks **9 and 12** are the hardest. Pace accordingly:
- Week 9 → consider splitting into 2 sessions (90 min + 60 min)
- Week 12 → consider a "ship party" on top of the regular call (3 hours, optional, social)

## Discord moderation

The `#baseline-agents` channel runs hot. Norms:
- All questions get a response within 4 hours during business hours, 24 hours otherwise
- "Show your code" is the standard first response (we don't debug from descriptions)
- Capstone showcase channel is read-only except for current cohort

## What you don't need to know

You don't need to be the world expert on:
- TanStack Router internals (we use it; we don't extend it)
- Vite plugin development (we use the configureServer hook; that's the whole API surface for us)
- LLM training (we use models; we don't train them)
- MCP spec edge cases (we use Hermes MCP; we don't write our own MCP server in this course)

If a student asks something deep in one of these areas, the right answer is: "I don't know — let's read the spec / docs together right now." That's the model.

## What you do need to know

- **Every weekly lab end-to-end.** You should have done all 12 of them before teaching the course.
- **The repo layout.** You should be able to point at any file by name and roughly describe what it does.
- **The agents' personalities.** When a student asks "which agent should I use for X?", you should answer in 1 sentence.

## Compensation (if you're a TA from a past cohort)

- $2k stipend per cohort taught
- Plus 20% revenue share on referrals you bring
- Plus your capstone gets archived & permanently featured

---

## Teaching this to engineers vs operators

Different audiences, same course, different *emphasis*:

| Engineer audience | Operator audience |
|---|---|
| Spend more time in `vite.config.ts` source | Spend more time on workflows + how to *use* the OS daily |
| Encourage forking + extending | Encourage adopting + integrating |
| Capstone leans Infrastructure track | Capstone leans Operator track |
| Less time on "why this matters" | More time on "why this matters" |

Both are valid. Both can ship great capstones.
