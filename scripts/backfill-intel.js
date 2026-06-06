// One-time backfill: send historical Circleback meeting notes to /api/account-intel
// Run: node scripts/backfill-intel.js

const VERCEL_URL = 'https://moonlit-horizon.vercel.app'
const DASHBOARD_PASSWORD = 'thetesttribe'
const BASIC_AUTH = 'Basic ' + Buffer.from(':' + DASHBOARD_PASSWORD).toString('base64')

// All corporate training accounts grouped from Circleback (Jan–Jun 2026)
const ACCOUNTS = [
  {
    account: 'Aspire Systems',
    meetings: [
      { date: '2026-03-23', notes: "Aspire's QA team needs practical AI training — currently only Sanoj and one junior have hands-on knowledge, rest of the team is self-studying via Udemy/Coursera with no live instruction. Two training tracks identified: LLM/AI evaluation and agent building. Sanoj needs sign-off from 2 senior managers before moving forward. Next step: customized outline and proposal deck, follow-up call the week of March 30th." },
      { date: '2026-05-11', notes: "Aspire wants to upskill ~900–1,000 testers in LLM evaluation across two tracks — 20-hour beginner and 14-hour advanced — with Option 1 trainer (VP-level, 17 yrs industry, 8 yrs training) selected for both. Pricing is ₹3,75,000 + GST combined (₹1,90,000 beginner + ₹2,10,000 advanced, ~5% discount applied). Batch size is 30 per batch. Aspire needs 2–3 weeks internally to get delivery team nominations and approvals before committing to a start date." },
      { date: '2026-05-20', notes: "Meeting covered training effectiveness metrics, capstone format, post-training follow-up, trainer continuity, and pricing. No final decisions made — Anurag is revisiting pricing and will share a revised proposal. Aspire is internally confirming batch sizes and cohort structure. Aspire's QA/testing team is 700+ people; target for initial training is 200–300, with 3–4 foundation batches in mind and at least 1 pilot batch to start. Primary trainer confirmed as Tony Ramchandani. Aspire needs revised commercials and a trainer demo session." },
      { date: '2026-05-20', notes: "The Test Tribe and Aspire Systems aligned on a multi-layered training effectiveness framework — during-training assessments, a capstone project, and optional 30/60/90-day post-training evaluations. Aspire pushed back on pricing and asked TTT to revisit commercials given potential for multiple batches. Primary trainer Tony Ramchandani confirmed, Aspire requested a ~45-minute pilot session before finalizing. Aspire targeting initial pilot batch, 2 batches likely to start, 3–4 foundation batches long-term. Key open items: revised pricing from TTT, Aspire to confirm cohort size." },
    ]
  },
  {
    account: 'Betterworks',
    meetings: [
      { date: '2026-04-22', notes: "Betterworks' Sriram wants to upskill 4 PMs (all India-based) in AI — covering AI in their workflow, building basic agents, and PM skills for AI-native products. Budget is ~$1,000–$2,000. Target completion is by end of June 2026. The Test Tribe will send a questionnaire to capture the team's current tool stack, then follow up with a training outline, trainer profile, and an intro call with the trainer." },
      { date: '2026-03-16', notes: "Day 1 of a 10-day agentic AI training for the Betterworks team, run by trainer Vignesh. Training DELIVERED — 10-day LangChain/LangGraph agentic AI program for the full Betterworks QA engineering team (~16 participants). Covers prompt engineering, memory, tool integration, multi-agent architecture, and human-in-the-loop patterns." },
      { date: '2026-04-01', notes: "Day 9 of the Agentic AI workshop — covered the final syllabus topic (multi-agent systems) with a full theoretical walkthrough and live build of an incident response multi-agent system. Training successfully delivered. Bonus session covering MCP + Playwright integration scheduled as Day 10." },
    ]
  },
  {
    account: 'Wartsila',
    meetings: [
      { date: '2026-03-13', notes: "Samata reviewed the training outline and is happy with the content. Wartsila prefers in-person training in Navi Mumbai. Virtual pricing starts at ₹7,000/hr, in-person at ~₹10,000–11,000/hr. Anurag will send a full proposal by March 16th; next meeting will include Samata's manager for the budget conversation." },
      { date: '2026-03-30', notes: "Sashank (Wartsila senior manager) is aligned on the training content and open to moving forward, but wants the curriculum spread out with more hands-on time and assignments after each session. Both agree the current 9-day, 2-hour/day structure is too condensed — to be revised. Target start is around May 2026, pending IP/vendor onboarding (NDA, PO) which Sashank estimates takes 1–3 weeks. Commercials will be finalized at contract stage on a per-hour rate basis." },
      { date: '2026-04-08', notes: "Anurag walked Samata through the revised 10-day, 23-hour training outline — Samata thinks it looks good overall and will share with her team for feedback. Wartsila's IT approval meeting is scheduled for the week of April 14th; follow-up on April 17th. Tentative training start is May 2026. NDA to be signed post-approval so Wartsila can share project details with trainer Tanweer." },
      { date: '2026-05-04', notes: "Wartsila wants to proceed with the training but needs the price brought down from ₹1.44L — Samata is targeting ₹90K–₹1L, The Test Tribe is holding at ₹1.25–1.3L. Anurag committed to sending a final quote today. Training is targeting a start in the 3rd or 4th week of May, running 2 days a week, 2 hours per session. Payment split is 70% upfront, 30% on completion." },
      { date: '2026-05-13', notes: "Training outline confirmed — 23-hour AI and Agentic AI program across 10 days, starting first week of June 2026. Sessions on Tuesdays and Fridays, 2–2.5 hours each. Samata walked through Wartsila's QA data stack — Jenkins, custom Site Builder web app, PyTest automation, Jira defects — and will share a sample report with Anurag before training starts. TRAINING IS CONFIRMED AND SCHEDULED FOR JUNE 2026." },
    ]
  },
  {
    account: 'Celestial Systems',
    meetings: [
      { date: '2026-05-28', notes: "The Test Tribe presented two training outlines to Celestial Systems' QA manager Neelay Mehta and leads Ankit and Sumana, with the goal of upskilling a ~50–55 person QA team on AI and agentic AI. Neelay's core goal is raising the team's AI leverage from ~30% to at least 60–70% so QA can reduce project estimates meaningfully — dev teams have already cut their estimates by more than half using coding agents. Training will be split into two tracks: a 24–28 hour beginners track for manual engineers and a 15–16 hour advanced track for the 15 automation engineers. Tanishq will share both training outlines by Friday, May 29th, and a follow-up call is scheduled for Tuesday, June 2nd at 12:30 PM to review. No budget has been allocated yet — Neelay will present the proposal to the operations team for approval." },
    ]
  },
  {
    account: 'Conga',
    meetings: [
      { date: '2026-03-24', notes: "Conga has dept-level approval and is now seeking CTO sign-off — Vaishal is presenting the proposal to the CTO next. Training track confirmed: 'Testing the AI' (20 hours total), priced at ₹2L — Agentic AI track tabled for a future engagement. Trainer (educator option 2, Germany-based) is available April 1–21, with Fridays and Saturdays blocked. Target start is April 1st; if training can't begin by April 15th, next availability is June. After CTO approval, next step is a call with Conga's finance team to sort onboarding and payment terms." },
      { date: '2026-04-29', notes: "Conga (Vaishal) has three distinct asks: QA team training (~30–35 members), a generic training for the dev team (~200 members), and a consultation/partnership engagement to build 3 agentic AI systems for the QA ecosystem. QA training budget is approximately ₹2 lakh. The QA training outline needs to be revisited to align with the three AI systems Conga wants to build. Agreed next step: 3 docs (revised QA training outline, consultation/partnership roadmap, generic dev training outline) by Monday, May 4th, then a trainer call Tuesday, May 5th at 2:30 PM." },
      { date: '2026-05-06', notes: "Training and consultation are two separate tracks — training is stalled in internal approvals, consultation on the automation agent (stream 1) is moving faster. Anurag walked Vaishal through the revised QA outline, which ends with building 3 specific agents across the final 6 hours. TTT flagged they're primarily a training/guidance org, not a services execution arm. Vaishal agreed to send Conga's conceptual agentic AI architecture diagram so TTT can assess effort. Goal is to schedule a joint meeting with Vaishal's VP next week with the trainer." },
      { date: '2026-05-06', notes: "Additional Conga meeting — Ashutosh confirmed agreement with a prior point on training approach." },
    ]
  },
  {
    account: 'WorkOnGrid',
    meetings: [
      { date: '2026-04-28', notes: "Discovery call with Shravya, QA Manager at WorkOnGrid, to scope a custom AI testing training for her 4-person team. Shravya wants to finish training by May end (before a major feature release) and the primary goal is automating smoke test cases for both web and mobile. Advanced 16-hour outline is more relevant, with particular interest in prompting techniques, MCP/AI agents, and Playwright + Cursor integration. Training is priced at ₹7,000–₹13,000/hour, so a 16-hour program runs roughly ₹1,12,000–₹2,08,000 total. Decision goes to the CTO." },
      { date: '2026-05-05', notes: "Shravya narrowed the training scope to 3 topics from the original 9-day outline: prompting techniques for testers, Cursor + Playwright integration, and smoke test automation for web and mobile. Revised plan is ~5–6 sessions at 1–1.5 hours/day, ending with a capstone. Anurag will send an updated outline and proposal today (May 5th) so Shravya can share with WorkOnGrid's CTO (Ayush Agwal) for budget approval. Shravya wants training complete and automation work actively underway by end of May 2026. A joint call with the trainer, Shravya, and the CTO is planned once the proposal is approved." },
    ]
  },
  {
    account: 'Stryker',
    meetings: [
      { date: '2026-04-17', notes: "The Test Tribe walked Gurdeep (Stryker) through a 10-session, 20-hour agentic AI for QA curriculum, which he wants to pitch to senior directors for a pilot with 10–15 people starting in June 2026. Stryker's QA team is ~100 people working across a highly diverse, IoT-connected 'smart hospital' platform — no common tech stack, languages include Python, Kotlin, and Java. Gurdeep's goal is a 'digital colleague' model: give an AI a user story and have it write code, test it, and raise a PR with minimal human intervention. Trainer cost ranges from ₹1.8L to ₹3.3L for 20 hours depending on seniority. Next step: Anurag sends a customized outline and proposal to Gurdeep before a 15-minute follow-up call on Friday, April 24th at 11:00 AM." },
      { date: '2026-04-24', notes: "Gurdeep reviewed the current training outline and wants AI evaluation (testing real-world AI apps, building test pipelines) added — Anurag confirmed it needs to be a separate module given the depth required. Anurag will revise the proposal to combine both outlines without worrying about time constraints, then share two full proposals over the existing email chain. Gurdeep will walk the proposals through senior managers and directors at Stryker and follow up with a decision." },
    ]
  },
  {
    account: 'Zoomcar',
    meetings: [
      { date: '2026-04-22', notes: "The Test Tribe and Deepak Patel (Zoomcar QA lead) met to explore a corporate AI upskilling training for Deepak's 11-person QA team. Team is already doing automation (Playwright, Appium, Rest Assured, K6) but has had no external training — all self-learning — and is struggling to implement AI in practice. Anurag walked through a sample 10–12 day training outline. No budget is pre-allocated — Deepak needs to get CPTO approval, then finance sign-off. Anurag will share a customized outline by Friday, April 24th or Saturday, April 25th and a proposal; follow-up call set for Monday, April 27th." },
      { date: '2026-04-29', notes: "Tanishq (The Test Tribe) walked Deepak (Zoomcar) through a 9-day AI-for-testing training proposal covering foundations through multi-agent workflows, priced at ₹2.5L (Trainer 1) or ₹3L (Trainer 2) plus GST. Deepak needs to review the outline, align with his team, and get CPTO and finance approval before committing. Budget is half-yearly and the training needs to be completed by end of October 2026; negotiation on pricing is expected. Next sync tentatively set for Wednesday, May 6th, with a trainer intro call to follow in the first or second week of June 2026." },
    ]
  },
  {
    account: 'Credit Saison',
    meetings: [
      { date: '2026-05-21', notes: "The Test Tribe walked Anurag Anand (Credit Saison) through a 10-day, 20-hour agentic AI training program for QA teams. Anurag wants to move fast — Credit Saison hasn't started formal AI training and feels behind the curve. Tentative team size is 20–30 (QA team of 24, possibly some devs added if CTO approves). Budget isn't a constraint — Credit Saison has unspent QA training budget for the financial year. Next step: The Test Tribe shares the outline and proposal (with pricing options) by Monday, May 25th; Anurag customizes it and presents to the CTO; Tanishq sets up a 15-minute follow-up call to align before it goes to the CTO." },
    ]
  },
  {
    account: 'Applied Data Finance',
    meetings: [
      { date: '2026-05-21', notes: "The Test Tribe walked ADF through a sample 10-day / 20-hour Agentic AI corporate training curriculum, and ADF is interested in moving forward. ADF's team is currently using AI only at a copy-paste level (ChatGPT and Windsurf) — the goal is to get them building multi-agent workflows across the SDLC. Team size is ~20 people; CTO approval is needed for budget, and Arun has a CTO call by Tuesday, May 26th. Anurag will send a customized outline by Monday, May 25th; follow-up meeting set for Thursday, May 29th at the same time." },
    ]
  },
  {
    account: 'Apex IT',
    meetings: [
      { date: '2026-05-19', notes: "Apex IT's QA team of 18 wants to scale from ~20% automation to a modern automation and AI stack, with Oracle as the primary application. No external QA training has happened before — this would be the first. The Test Tribe will send a customized proposal by Wednesday, May 20th covering tool recommendations, training structure, budgets, and benefits framed for senior leadership. Follow-up call scheduled for Tuesday, May 26th at the same time. Decision sits with Hina, but requires sign-off from a VP onshore in the US; no budget has been allocated yet." },
      { date: '2026-05-26', notes: "Day 1 of the training outline needs a full revision — the team has 10+ years of Selenium experience and wants to move to a low-code/no-code AI-embedded tool, not train on Selenium again. Anurag committed to sharing a revised outline and tool recommendations (supporting both Oracle and Salesforce) by end of day May 26th or May 27th at the latest. Core objective clarified: Apex IT wants a QA tool with AI enhancements built in, plus a roadmap for adopting agentic AI — not just standalone agent-building training. Next meeting will include the trainer once the outline and tool suggestions are approved." },
    ]
  },
  {
    account: 'Hewlett Packard',
    meetings: [
      { date: '2026-05-29', notes: "Pushpa (HP) is exploring AI training and implementation support for her QA team to cut release cycles from 3 months to 1 month near-term, then 1–2 weeks, and reduce manual effort per engineer. Anurag walked through a sample 10-day / 20-hour Agentic AI curriculum and shared a past result: one team's release cycle dropped from 3 weeks to 2 days post-training. Anurag will send a customized training outline, proposal, and ROI doc by Monday or Tuesday, June 1–2. Pushpa will review internally with her QA director and come back — training ideally starts in June." },
    ]
  },
  {
    account: 'RxLogix',
    meetings: [
      { date: '2026-03-13', notes: "RxLogix confirmed they want version 2 of the training plan — the full agentic AI track. Vignesh demoed two agents: one converts JIRA stories to test cases via LLM, the second uses Playwright MCP to auto-write and execute the resulting automation tests. RxLogix uses X-Ray (JIRA plugin) for test management — the agent can push to X-Ray via its API. Prem raised a compliance concern — RxLogix operates in a regulated domain with customer data subject to audits, and the training and resulting implementation need to be audit-ready. Anurag offered 1 complimentary post-training hour for implementation questions, plus agreed to add a mid-training support session." },
      { date: '2026-05-28', notes: "RxLogix wants training on both ISO 42001 and NIST AI RMF — primary goal is getting the company ISO 42001 certified. Scope expanded during the call: originally scoped as NIST AI RMF only, now includes full ISO 42001 implementation training (40 hours total). RxLogix is already ISO 27001 certified, which Benita confirmed is a foundation they can build on for 42001. Training can't start until after June 24th — Benita is running back-to-back 27001 and 42001 trainings from June 2nd through June 24th. Next step is Arpit sharing feedback with Shamayla, who will coordinate with The Test Tribe; an NDA needs to be signed before RxLogix shares existing docs." },
    ]
  },
  {
    account: 'Infiniti Software Solutions',
    meetings: [
      { date: '2026-05-19', notes: "Infiniti wants a revised training proposal covering two phases: Phase 1 is legacy PHP code migration to a new framework, Phase 2 is unit testing, security, load, and performance testing. Training should be in-person in Chennai, cover full-stack dev and QA together (starting with managers and team leads). Anurag committed to sharing a revised outline and proposal by May 20th. Infiniti prefers a Tamil-speaking trainer but will accept a strong communicator; trainer must be in-person in Chennai — virtual is not acceptable. Batch size is capped at 30, extendable to 40 with a pro rata charge per additional person above 30." },
    ]
  },
  {
    account: 'Cohesity',
    meetings: [
      { date: '2026-04-17', notes: "The Test Tribe met with Tataram Adapa from Cohesity to explore AI upskilling for his performance testing team. Tataram's team of ~25 has uneven AI readiness — only ~5–6 members are fully comfortable, the rest are early-stage. No commitment made — Tataram needs to check with his manager and potentially the internal L&D/HR team on budget before moving forward. Anurag will send a customized training proposal; follow-up call set for May 6th or 7th after Tataram returns from travel." },
      { date: '2026-05-22', notes: "Cohesity is currently running internal training led by senior staff engineers, so the proposed training isn't moving forward right now. Tataram wants to revisit in 2–3 months once an ongoing STLC/agentic AI development project wraps and the team needs onboarding. Anurag walked through the 5-day, 20-hour outline and Tataram confirmed it makes sense — no changes requested. Pricing for a batch of up to 30 people: ₹1.8–2.2 lakh for the full 20 hours." },
    ]
  },
  {
    account: 'Bloomreach',
    meetings: [
      { date: '2026-04-24', notes: "Bloomreach's QA team (18 people, led by Sujala and Babu) is exploring a customized Playwright upskilling bootcamp — not AI training, which they're already handling in-house. No budget set yet; Bloomreach wants a proposal with commercials first so they can fit it into H2 plans. Anurag will send 4–5 customized training outlines and a proposed plan covering beginner and advanced tracks, with in-person and virtual pricing options. Decision sits with Sujala and Babu — the key open question is whether this is the right training at the right time, not budget approval." },
    ]
  },
  {
    account: 'Wabtec',
    meetings: [
      { date: '2026-04-17', notes: "The Test Tribe walked Ashok (Wabtec) and his colleague Praveena through a proposed 10-day agentic AI training program for Wabtec's QA team. Ashok thinks the content is good but needs to check with his manager on budget and whether internal AI training is already planned. Pricing range is ₹1.3–2.8 lakh for the full team; a follow-up call is set for Thursday or Friday, April 23rd or 24th to include Ashok's manager. No timeline or budget confirmed yet — both are pending manager sign-off." },
    ]
  },
  {
    account: 'Tungsten Automation',
    meetings: [
      { date: '2026-04-20', notes: "The Test Tribe walked Tungsten Automation through a proposed 20-hour AI/QA training agenda, covering agentic AI setup, prompt engineering, MCP, LangChain/LangGraph, RAG-based failure analysis, and API/analytics agents. Tungsten's priority has shifted from consultation + training to training-focused, with the intent to open it up beyond Ganesa's team to multiple internal teams. Budget is approved informally by the CTO but needs to be scoped correctly upfront. Kai wants time budgeted for engineers beyond the 20 training hours — TTT's estimate is 8–20 additional hours to deploy an end-to-end workflow post-training." },
      { date: '2026-05-28', notes: "Vignesh demoed his Agentic AI training approach for Tungsten Automation's QA teams — covering test case generation agents, RAG-based memory, and an incident response pipeline with a web UI. Training is Python-based (not no-code tools). Agents are built to be model-agnostic — switching between GPT, Claude, Gemini, or other LLMs requires minimal code changes. Curriculum runs from Agentic AI basics up through LangChain, LangGraph, RAG, memory, and prompt engineering." },
    ]
  },
  {
    account: 'Horizontal',
    meetings: [
      { date: '2026-04-13', notes: "Anurag walked Vipul and Prashant through a proposed 10-day Agentic AI training outline, but the outline needs to be revised to fit Horizontal's actual QA context before moving forward. Horizontal's focus is Sitecore-based CMS projects — Anurag needs to confirm a trainer with Sitecore experience and get back by Tuesday, April 14th. Key gap surfaced: ~75% of Horizontal's projects are short-cycle (6–9 months) UI/component validation work where automation scripts aren't reused, so the value of the current outline isn't obvious. Next step is a 15–20 min intro call with the trainer on Friday, April 17th at 3:00 PM." },
      { date: '2026-04-24', notes: "The Horizontal team (pshah@horizontal.com, vkayasth@horizontal.com) didn't join — Anurag tried reaching them but got no response. Anurag will share an update with Saket off-call via WhatsApp. Communication has gone cold." },
    ]
  },
  {
    account: 'Get Well',
    meetings: [
      { date: '2026-05-14', notes: "Anurag walked Vaishali through two training tracks The Test Tribe built for a prior client — Playwright foundations and Agentic AI for QA — to assess fit for Get Well's team. Get Well's team is already building agents and using Cursor, so Track 1 is largely unnecessary; Track 2 (multi-agent workflows, self-healing locators, AI ROI) is the relevant focus. No budget is currently allocated for external training in the India team — Anurag will send a custom proposal with an outline and trainer options (both offline and virtual) to move the conversation forward with Vaishali's director." },
    ]
  },
  {
    account: 'Excelsoft Technologies',
    meetings: [
      { date: '2026-05-04', notes: "The Test Tribe met with Excelsoft Technologies (Suvarna, Vathsala, Krishna, Hari, Saranraj, Ummer) to scope a QA upskilling engagement. Excelsoft's core goals: help manual testers start automating with AI, and speed up existing automation QAs — targeting a 40–50% reduction in testing effort. The Test Tribe walked through a draft 23-hour, 9-day training outline focused on Agentic AI for QA, built around Playwright and TypeScript with Cursor as the primary IDE. Training scope, batch structure, and cost options are still open — Anurag will send a revised outline and trainer profiles, then schedule a call between Excelsoft and the trainer before proceeding. Excelsoft wants to start within 1–2 weeks (by around May 14–18, 2026)." },
    ]
  },
  {
    account: 'Ajio (RIL)',
    meetings: [
      { date: '2026-04-30', notes: "Tanishq walked Rahul through a customized 23-hour, 9-day AI automation training outline built around Ajio/RIL's team pain points. Rahul wants a small POC/prototype added to the outline to show how training will help the team build and manage automation at scale. Trainer options range from ₹2L+GST (8 yrs experience) to ₹4.1L+GST (16 yrs experience) — Rahul needs to check budget and get leadership sign-off before any negotiation. Tentative training start is last week of May; trainer intro call pushed to second week of May due to a release next week." },
    ]
  },
  {
    account: 'Qualizeal',
    meetings: [
      { date: '2026-05-22', notes: "The Test Tribe walked Sameer (Qualizeal) through a 10-day Agentic AI training outline, but Sameer thinks his teams are already ~50% covered, so Anurag will send a shortened, customized outline — likely 1–2 days — along with a proposal with 3–4 trainer options at different price points. Sameer's core need is automation speed: teams are blocked waiting for features to deploy before they can start automation, and clients want QA sign-off within the sprint without extensions. No timeline or team size decided yet — Sameer wants to see the outline first and will assess value before committing." },
    ]
  },
  {
    account: 'M2P Fintech',
    meetings: [
      { date: '2026-03-11', notes: "M2P Fintech is exploring corporate training for their backend QA team, which struggles with API testing across ~170 APIs in 10–12 microservices. Anurag suggested a training plus consultation model and will find a trainer with a card transactions/fintech background. Training outline due by Monday, March 16th; follow-up call with the trainer scheduled for Wednesday, March 18th at 12:00 PM. Mohan needs to loop in management before any training can be approved." },
      { date: '2026-03-18', notes: "Mohan hadn't reviewed the training outline yet and wants to connect directly with the trainers before finalizing it — Anurag will share the 3 trainer profiles over email. Training budget range is ₹1.62 lakh to ₹2.7 lakh depending on the trainer; Mohan says budget isn't his concern but needs to loop in senior team before any decision." },
    ]
  },
  {
    account: 'ExaThought',
    meetings: [
      { date: '2026-03-18', notes: "Preethi rated the Agentic AI for Testers training 4.5/5, with strong praise for depth, trainer flexibility on time, and relevance to the team's actual work. The team is already building agents and reduced API automation script creation from 4 days to 4 hours (achieved Monday, March 16th). Recordings are being used to onboard 2 new QA hires who missed the training. Main improvement feedback: low trainer energy (Ramadan context) and not enough interactivity. Preethi consented to a testimonial and will connect Anurag with her HR team for future training needs. TRAINING DELIVERED SUCCESSFULLY." },
    ]
  },
  {
    account: 'CRISIL',
    meetings: [
      { date: '2026-04-06', notes: "The Test Tribe walked Ravi through the 10-day AI/QA training outline — Ravi found it relevant but high-level, and the team agreed to refine it based on CRISIL's specific use case. Custom MCP (not Playwright MCP) is the right direction given CRISIL's multi-app, interdependent architecture. Ravi needs director approval and compliance sign-off before committing — CRISIL is also evaluating other vendors. Tentative start is first week of May 2026 if approvals go smoothly. Anurag to send a revised outline with clear outcomes/benefits; Ravi will follow up once he has internal alignment." },
    ]
  },
  {
    account: 'Rollick',
    meetings: [
      { date: '2026-03-20', notes: "Anurag walked Bharath through a 10-day agentic AI training outline for Rollick's QA team, covering Python basics through multi-agent workflows. Bharath's team already uses Jira MCP and Devin.ai, so the key value add is multi-agent orchestration (LangChain/LangGraph) and the ability to build custom tools rather than rely on subscriptions. Anurag agreed to add a 2-day AI testing module to the outline covering probabilistic testing, drift detection, and model governance. Next meeting is Thursday, March 26th at 3:00 PM with the trainer included." },
      { date: '2026-04-06', notes: "Anurag walked Bharath through the proposed 10-day Agentic AI training outline — Bharath found the topics relevant and wants a more detailed doc before pitching to his management. Follow-up call set for April 21st. Bharath's team is already using MCP with VS Code, so that module may need to be adjusted or replaced with pain-point-focused content. Anurag is looking for a second trainer local to Trivandrum/Kerala." },
    ]
  },
  {
    account: 'Intelligent Audit',
    meetings: [
      { date: '2026-05-13', notes: "Muthuvel (QA Architect at Intelligent Audit) is looking for consultation on using agentic AI to enable in-sprint functional testing — reducing production bugs by getting test scenarios and scripts committed in parallel with dev changes. He's not looking for a tool (the company already has open access to Claude, OpenAI, etc.) — he needs guidance on how to leverage what they have. Two paths are on the table: a consultation/implementation engagement (would require CTO approval) or individual training for Muthuvel himself (which he could pursue independently and then pitch internally). Anurag will follow up by Friday, May 15th with a questionnaire." },
    ]
  },
  {
    account: 'Indusface',
    meetings: [
      { date: '2026-04-21', notes: "The Test Tribe walked Indusface's QA team through a 10-day agentic AI training program. Indusface wants to build internal AI agents for test case generation, script generation, traceability matrix mapping, and reporting — driven by security concerns about using public LLMs like ChatGPT with proprietary product data. Team is 10 QAs, uses Java (and some JavaScript), and has done a POC with OLAMA 0.2.7. No external training budget is currently allocated; Guru needs to propose to the CTO and get finance approval — he expects days, not months. Guru's ideal start is the first week of May 2026; next step is a 15-minute follow-up call on Friday, April 24th." },
    ]
  },
  {
    account: 'In Time Tec',
    meetings: [
      { date: '2026-04-02', notes: "In Time Tec wants to upskill 60–100 manual QAs to increase productivity and enable each QA to cover multiple projects. Anurag walked through a 10-day agentic AI training outline and Poola confirmed it's relevant, but wants a customized version that addresses manual QA use cases specifically — not just automation engineers. Anurag to send a tailored proposal with a manual-QA-focused outline, proof of results, and ROI data by Friday, April 3rd. Follow-up call scheduled for Thursday, April 9th." },
      { date: '2026-04-13', notes: "Anurag walked Poola and Suresh through the 11-day AI for QA training outline — Poola hadn't received the doc, so Anurag will resend it. Anurag also walked through 3 trainer profiles and pricing; Poola will review both the outline and pricing and take them to the leadership team. Follow-up call scheduled for Thursday, April 16th." },
    ]
  },
  {
    account: 'Motorola',
    meetings: [
      { date: '2026-05-25', notes: "Motorola (Thejasvi) is evaluating AI vendors for implementation help — specifically around automating data aggregation/reporting and improving data quality for the global sales ops, data science, and pricing strategy team. Scope is implementation-only, not training — Thejasvi wants an expert to come in and solve problems, not upskill the team. The Test Tribe has 3 relevant case studies in sales/marketing ops but can't share client details due to NDAs. Thejasvi needs ROI-focused case studies to present to his director. Next step is Anurag sharing the deck first, then setting up a call with a TTT AI/ML expert." },
    ]
  },
  {
    account: 'Nasdaq',
    meetings: [
      { date: '2026-05-21', notes: "Pluffy's NASDAQ surveillance team (12 QAs) is mid-migration from a legacy system to Java and wants to explore agentic AI training — but not until the migration wraps up, which is roughly 6 months out. Anurag walked through two training outlines. NASDAQ's strict security environment (restricted software installs, heavy auth requirements) is a constraint. Pluffy will raise the training discussion with senior management and get back to Tanishq; Anurag suggested a check-in every 2 months." },
    ]
  },
  {
    account: 'Alghanim Industries',
    meetings: [
      { date: '2026-05-07', notes: "Anurag (The Test Tribe) and Rakesh (Alghanim Industries QA Manager) met to explore corporate training and consulting services. Alghanim is currently 100% manual testing with zero automation — actively looking for an automation blueprint/consulting engagement, not just training. Rakesh is also interested in agentic QA workflows to cover the full software testing lifecycle. No decisions made — Anurag to follow up over email with rate cards, past implementation work (especially agentic), and an automation blueprint proposal; next steps depend on that." },
    ]
  },
  {
    account: 'Karnataka Bank',
    meetings: [
      { date: '2026-04-22', notes: "The Test Tribe met with Manish from Karnataka Bank's Digital Center of Excellence to explore QA upskilling for his team. The core gap is that the internal SME testers come from BFSI business backgrounds, not testing — they lack industry-standard testing practices (test plans, test cycles, edge case coverage). AI/agentic testing is on the radar but not the immediate priority — Manish wants process fundamentals addressed first, then AI layered on top. Anurag will send 2 customized proposals by Friday, April 24th. Follow-up call planned for the first week of May 2026, with the relevant trainer included." },
    ]
  },
  {
    account: 'Barclays',
    meetings: [
      { date: '2026-03-30', notes: "Intro/discovery call — The Test Tribe walked Sushant through their agentic AI training program for QA teams. Sushant is interested and wants to take a customized proposal back to CTO/CIO-level management for approval. Anurag will send a proposal tailored to Barclays' tech stack, with relevant use cases, outcome metrics from past trainings, and LLM token cost estimates. Sushant wants to start within ~1 month if approved (around late April/early May 2026)." },
    ]
  },
  {
    account: 'Perfios',
    meetings: [
      { date: '2026-04-22', notes: "Exploratory call — Raja came in without a concrete upskilling plan and wants to review options before going back internally with a proposal. Perfios has ~80 QAs across 3 cities, weekly releases, and is mid-transformation on AI adoption, making upskilling timely but not yet budgeted. Raja sees Section 1 (Agentic AI testing) as relevant for a smaller core group and Section 2 (LLM/AI model evaluation) as relevant for the broader team. No commitment made — Raja needs the training outline and cost info to assess against AOPs before deciding on next steps. Anurag to share the outline; follow-up call in 1–2 weeks." },
    ]
  },
  {
    account: 'Piramal Finance',
    meetings: [
      { date: '2026-04-15', notes: "Piramal Finance has a 30-person QA team with a 10:1 developer-to-QA ratio they want to bring to 80:1 — automation maintenance is the core blocker. Varun's team has already built backend automation, API agents, CI/CD integration, and AI-driven code coverage, so the training need is narrowed to two things: Piramal-specific test case generation (using RAG) and UI automation maintenance/self-healing. Anurag walked through a 4–5 day, 16-hour training outline but Varun confirmed the team can only commit 1–1.5 days (~6–9 hours), so the curriculum needs to be condensed. No decisions can be made until Varun's director returns — expected back April 17th." },
    ]
  },
]

async function callAPI(account, meetings) {
  const response = await fetch(`${VERCEL_URL}/api/account-intel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': BASIC_AUTH,
    },
    body: JSON.stringify({ account, meetings }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`HTTP ${response.status}: ${text}`)
  }

  return response.json()
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  console.log(`Starting backfill for ${ACCOUNTS.length} accounts...`)
  console.log(`Target: ${VERCEL_URL}/api/account-intel\n`)

  let success = 0
  let errors = 0

  for (const { account, meetings } of ACCOUNTS) {
    try {
      process.stdout.write(`  ${account} (${meetings.length} meetings)... `)
      const result = await callAPI(account, meetings)
      console.log(`✅ ${result.intel.status} — ${result.intel.nextAction}`)
      success++
      await sleep(800) // rate limit: ~1.25 req/sec
    } catch (err) {
      console.log(`❌ ${err.message}`)
      errors++
    }
  }

  console.log(`\n✅ Done: ${success} generated, ${errors} failed`)
}

main().catch(console.error)
