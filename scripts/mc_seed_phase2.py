import requests, json, sqlite3, time, os
from secrets import SystemRandom

# Cryptographically secure RNG. These values feed a cost-ledger seed which,
# while a dev/demo fixture, should not be predictable from elsewhere.
_rng = SystemRandom()

BASE = "http://127.0.0.1:3000"
db_path = os.path.join(os.getcwd(), '.data', 'mission-control.db')

def auth():
    r = requests.post(f"{BASE}/api/auth/login", json={"username": "slim", "password": "SlimCharles2026!"})
    if r.status_code != 200:
        raise RuntimeError(f"Auth failed: {r.text}")
    return {"Cookie": f"mc-session={r.cookies['mc-session']}", "Content-Type": "application/json"}

H = auth()
print("AUTH: OK")

# =============================================
# PHASE 2: AI WORKFORCE — 12 Agents with souls, memory
# =============================================
agents = [
    {"name": "Hermes", "role": "agent", "soul": "Strategic Orchestrator. Coordinates all agent operations. Routes tasks to specialists. Escalates blocked tasks. Full access: terminal, file, web, browser, delegation, memory, skills, search."},
    {"name": "VisionOps-Worker", "role": "researcher", "soul": "Visual Intelligence. Analyzes inspection photos. Identifies damage: water, fire, structural, cosmetic. Generates repair scope with pricing. Escalate: confidence <80% to human. Tools: vision, file, memory."},
    {"name": "VoiceOps-Worker", "role": "assistant", "soul": "Communications. AI receptionist, call triage, transcription, scheduling. Emergency calls -> immediate dispatch. Routine -> queue. Tools: terminal, memory."},
    {"name": "Market-Swarm-Worker", "role": "researcher", "soul": "Lead Intelligence. Scrapes PM directories, finds 100+ unit prospects, validates, scores, drafts outreach. 500+ units -> flag for Saul. Tools: web, search, file."},
    {"name": "Research-Worker", "role": "researcher", "soul": "Market Research. Regulatory changes, competitive intelligence, pricing analysis. 3+ sources per report. Tools: web, search, file."},
    {"name": "Dispatcher-Worker", "role": "assistant", "soul": "Vendor Dispatch. Routes to optimal vendor by score, proximity, specialty. No vendor in 2hrs -> escalate to Chief Phil. Tools: terminal, memory."},
    {"name": "QA-Trust-Worker", "role": "reviewer", "soul": "Quality and Trust. Reviews outputs for completeness, accuracy, evidence. Scans skills for injection, credential leaks. Auto-reject: missing evidence or pricing. Tools: file, search."},
    {"name": "Executive-Assistant", "role": "assistant", "soul": "Executive Ops. Standup reports, daily summaries, progress tracking. Reports by 8AM. All blocked items highlighted. Tools: file, memory, search."},
    {"name": "Chief Phil Gaston", "role": "operator", "soul": "PM Division Chief. Maintenance management, vendor oversight, compliance portfolios. High-value orders >$5K. Compliance violations -> owner notification. Tools: terminal, file, search."},
    {"name": "Saul", "role": "operator", "soul": "Head of Brokerage Conversion. Warm lead follow-up, CRM pipeline, proposals, closes. 2hr response SLA. Tools: web, search, memory."},
    {"name": "Don Draper", "role": "agent", "soul": "Marketing Director. Brand strategy, content, campaigns, landing pages. All campaigns need A/B variant, CTA, target. Tools: web, search, file."},
]

print("\nPHASE 2: AI WORKFORCE MODEL")
aid_map = {"Slim Charles": 1}

for a in agents:
    r = requests.post(f"{BASE}/api/agents", json={"name": a["name"], "role": a["role"]}, headers=H)
    d = r.json()
    agent = d.get("agent", {})
    aid = agent.get("id")
    if aid:
        aid_map[a["name"]] = aid
        # Set soul
        if a.get("soul"):
            r2 = requests.put(f"{BASE}/api/agents/{aid}/soul", json={"soul_content": a["soul"]}, headers=H)
        # Set working memory for core agents
        if a["name"] in ["Hermes", "VisionOps-Worker", "VoiceOps-Worker", "Market-Swarm-Worker"]:
            req = requests.put(f"{BASE}/api/agents/{aid}/memory", json={"working_memory": f"Active agent in PropControl ecosystem. Role: {a['soul'][:50]}", "append": False}, headers=H)
        print(f"  #{aid} {a['name']:22s} ({a['role']}) soul={'OK' if a.get('soul') else '-'}")

print(f"\nTotal agents in map: {len(aid_map)}")

# =============================================
# PHASE 2: TASK LIFECYCLE — 12 tasks
# =============================================
print("\nPHASE 2: TASKS")
now = int(time.time()) + 7*24*3600

tasks_data = [
    ("Inspect Unit 4B - Water Damage Assessment", "Tenant reported water damage in bathroom. Full inspection with photos.", "high", "VisionOps-Worker", 2),
    ("Inspect Unit 12A - Fire Damage", "Insurance claim. Document all damage for adjuster.", "high", "VisionOps-Worker", 2),
    ("Cold outreach to 50 PMs Columbus OH", "Market swarm: find PMs with 100+ units. Draft personalized emails.", "medium", "Market-Swarm-Worker", 2),
    ("Configure AI receptionist after-hours", "Voice pipeline: call to transcribe to classify to dispatch.", "medium", "VoiceOps-Worker", 2),
    ("Research PM regulations Ohio 2026", "Compile updated state regulations.", "low", "Research-Worker", 2),
    ("Weekly standup report PropControl", "Agent activities, blocked tasks, approvals, costs.", "low", "Executive-Assistant", 2),
    ("Scan skills for vulnerabilities", "Security audit on 600+ skills.", "high", "QA-Trust-Worker", 2),
    ("Dispatch HVAC repair Unit 8C", "Owner approved $1,200 HVAC replacement.", "high", "Dispatcher-Worker", 2),
    ("Follow up 15 warm leads", "Leads from last campaign showed interest.", "medium", "Saul", 2),
    ("Draft brand campaign Q2", "Content strategy and campaign assets.", "medium", "Don Draper", 2),
    ("Compliance review 25-unit portfolio", "Annual compliance review.", "high", "Chief Phil Gaston", 2),
    ("Generate rehab scope from 40 photos", "Process move-out inspection photos. Generate complete scope.", "high", "VisionOps-Worker", 2),
]

task_ids = []
for title, desc, pri, agent, proj in tasks_data:
    r = requests.post(f"{BASE}/api/tasks", json={
        "title": title, "description": desc, "priority": pri, "due_date": now,
        "assigned_to": agent, "project_id": proj,
        "tags": [agent.lower().replace("-worker",""), pri],
    }, headers=H)
    tid = r.json().get("task", {}).get("id")
    if not tid:
        print(f"  FAIL '{title[:40]}': {r.status_code} {r.text[:80]}")
        continue
    task_ids.append(tid)
    requests.put(f"{BASE}/api/tasks/{tid}", json={"status": "assigned"}, headers=H)
    requests.put(f"{BASE}/api/tasks/{tid}", json={"status": "in_progress"}, headers=H)
    if len(task_ids) <= 6:
        requests.put(f"{BASE}/api/tasks/{tid}", json={"status": "done", "outcome": "success", "resolution": "Completed."}, headers=H)
        print(f"  #{tid} [{pri:>8s}] {title[:50]}... DONE")
    else:
        print(f"  #{tid} [{pri:>8s}] {title[:50]}... IN_PROGRESS")

print(f"\n{len(task_ids)} tasks created")

# Quality reviews
print("\nQUALITY REVIEWS")
if len(task_ids) >= 3:
    for tid, st, notes in [
        (task_ids[0], "approved", "Comprehensive damage assessment with line-item costs."),
        (task_ids[1], "approved", "Insurance documentation complete with photos."),
        (task_ids[2], "rejected", "Missing prospect license verification."),
        (task_ids[6], "approved", "Security scan complete. 3 patterns flagged, rest cleared."),
    ]:
        r = requests.post(f"{BASE}/api/quality-review", json={"taskId": tid, "reviewer": "QA-Trust-Worker", "status": st, "notes": notes}, headers=H)
        print(f"  Task #{tid} -> {st.upper()} [{r.status_code}]")

# =============================================
# PHASE 2: COST TRACKING
# =============================================
print("\nCOST TRACKING")
amodels = {1:"anthropic/claude-sonnet-4", 2:"anthropic/claude-sonnet-4", 3:"google/gemini-2.5-flash", 4:"anthropic/claude-sonnet-4", 5:"openai/gpt-4o", 6:"openai/gpt-4o", 7:"anthropic/claude-sonnet-4", 8:"anthropic/claude-sonnet-4", 9:"openai/gpt-4o", 10:"anthropic/claude-sonnet-4", 11:"anthropic/claude-sonnet-4", 12:"openai/gpt-4o"}
aname = {1:"Slim Charles", 2:"Hermes", 3:"VisionOps-Worker", 4:"VoiceOps-Worker", 5:"Market-Swarm-Worker", 6:"Research-Worker", 7:"Dispatcher-Worker", 8:"QA-Trust-Worker", 9:"Executive-Assistant", 10:"Chief Phil Gaston", 11:"Saul", 12:"Don Draper"}

for aid in range(1,13):
    inp = _rng.randint(2000, 50000)
    out = _rng.randint(500, 8000)
    sess = f"sess-{aname.get(aid,'x')}-{int(time.time())}-{_rng.randint(100,999)}"
    r = requests.post(f"{BASE}/api/tokens", json={"model": amodels.get(aid,"anthropic/claude-sonnet-4"), "sessionId": sess, "inputTokens": inp, "outputTokens": out, "operation": "chat_completion"}, headers=H)
    c = r.json().get("record", {}).get("cost", "?")
    print(f"  {aname.get(aid,str(aid)):20s} {inp+out:>7,} tokens ${c}")

# =============================================
# PHASE 2: WORKFLOWS + PIPELINES
# =============================================
print("\nWORKFLOWS")
wf_ids = []
for w in [
    {"name": "Inspection to Dispatch Pipeline", "description": "inspection to dispatch", "model": "anthropic/claude-sonnet-4", "task_prompt": "Process inspection. Identify damages. Generate scope. Route for approval. Dispatch.", "timeout_seconds": 300, "agent_role": "researcher"},
    {"name": "Lead Generation Sprint", "description": "Scrape validate score outreach", "model": "openai/gpt-4o", "task_prompt": "Search PMs with 100+ units. Verify. Score. Draft outreach. CRM.", "timeout_seconds": 600, "agent_role": "researcher"},
    {"name": "Voice Receptionist Pipeline", "description": "Call transcription dispatch", "model": "anthropic/claude-sonnet-4", "task_prompt": "Transcribe call. Classify urgency. Emergency dispatch. Routine queue.", "timeout_seconds": 120, "agent_role": "assistant"},
]:
    r = requests.post(f"{BASE}/api/workflows", json=w, headers=H)
    t = r.json().get("template", {})
    if t.get("id"):
        wf_ids.append(t["id"])
        print(f"  #{t['id']} {t['name']}")

print("\nPIPELINES")
if len(wf_ids) >= 2:
    r = requests.post(f"{BASE}/api/pipelines", json={"name": "Inspection Pipeline", "description": "Automated processing", "steps": [{"template_id": wf_ids[0], "on_failure": "stop"}, {"template_id": wf_ids[1], "on_failure": "continue"}]}, headers=H)
    pid = r.json().get("pipeline", {}).get("id")
    if pid:
        r2 = requests.post(f"{BASE}/api/pipelines/run", json={"action": "start", "pipeline_id": pid}, headers=H)
        rid = r2.json().get("run", {}).get("id")
        print(f"  Pipeline run #{rid} [{r2.status_code}]")

# =============================================
# PHASE 2: WEBHOOKS
# =============================================
print("\nWEBHOOKS")
for wh in [
    {"name": "Slack Alerts", "url": "https://hooks.slack.com/services/T00/DEMO/S123", "events": ["task.fail", "task.done"]},
    {"name": "Zapier CRM Sync", "url": "https://hooks.zapier.com/hooks/catch/demo/123/", "events": ["task.done"]},
    {"name": "PropControl Handler", "url": "https://propcontrol.example.com/webhooks", "events": ["task.done"], "generate_secret": True},
]:
    r = requests.post(f"{BASE}/api/webhooks", json=wh, headers=H)
    print(f"  {wh['name']:22s} [{r.status_code}]")

# =============================================
# PHASE 3: MEMORY
# =============================================
print("\nMEMORY")
for m in [
    {"path": "strategy/gtm-plan.md", "action": "create", "content": "GTM: Columbus OH PMs 100+ units. Audit $500-$1K. Setup $3K-$5K. Buildout $8K-$15K + $500-$1K/mo."},
    {"path": "metrics/performance.md", "action": "create", "content": "Water: 94%. Structural: 89%. Cosmetic: 96%. 500 test inspections."},
    {"path": "operations/sla.md", "action": "create", "content": "Dispatch 2hrs: 95%. Inspection 24hrs: 99%. Owner response 48hrs: 87%."},
]:
    r = requests.post(f"{BASE}/api/memory", json=m, headers=H)
    print(f"  {m['path']:26s} [{r.status_code}]")

# =============================================
# FINAL DB STATE
# =============================================
print(f"\n{'='*60}")
db = sqlite3.connect(db_path)
for t in ["agents", "tasks", "projects", "quality_reviews", "activities", "audit_log", "security_events", "workflow_templates", "skills", "webhooks", "pipeline_runs"]:
    try:
        c = db.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
        tag = "OK" if c > 0 else "  "
        print(f"  [{tag}] {t}: {c}")
    except Exception as e:
        print(f"  [X]  {t}: {e}")

tf = os.path.join(os.getcwd(), '.data', 'mission-control-tokens.json')
if os.path.exists(tf):
    with open(tf) as f:
        toks = json.load(f)
    tc = sum(t.get('cost',0) for t in toks)
    print(f"  [OK] token_usage: {len(toks)} records, ${tc:.2f}")

print("\nTasks:")
for t in db.execute("SELECT id, substr(title,1,50), status FROM tasks ORDER BY id"):
    print(f"  #{t[0]} [{t[2]:>16s}] {t[1]}")

print("\nAgents:")
for a in db.execute("SELECT id, name, role FROM agents ORDER BY id"):
    print(f"  #{a[0]} {a[1]:22s} {a[2]}")

print("\nQuality reviews:")
for q in db.execute("SELECT id, task_id, status FROM quality_reviews ORDER BY id"):
    print(f"  #{q[0]} task #{q[1]} -> {q[2]}")

db.close()
print(f"\n{'='*60}\nPHASE 1 + PHASE 2 COMPLETE\n{'='*60}")
