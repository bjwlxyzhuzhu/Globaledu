# Reddit Agent PoC Plan

**Goal:** 3 Reddit accounts, subtle product promotion, minimal cost, built solo in ~1-2 weeks.

---

## Cost: $70-150/month

| Item | Monthly |
|------|---------|
| **3 residential proxies** (IPRoyal/BrightData) | $15-21 |
| **DeepSeek API** (content gen, ~$0.14/1M tokens) | $5-10 |
| **VPS or local machine** (you already have one) | $0 |
| **Playwright** (free, persistent contexts = no GoLogin needed at this scale) | $0 |

You can skip GoLogin at 3 accounts — Playwright's `launchPersistentContext` gives you isolated browser profiles with unique fingerprints for free.

---

## Architecture

```
accounts.json          ← 3 accounts, each with persona, proxy, subreddits
       |
       v
   scheduler.ts        ← picks next account ready for action
       |
       v
   content-gen.ts      ← calls DeepSeek API with persona-specific prompts
       |
       v
   browser.ts          ← launches isolated Playwright context for that account
       |               ← routes through account-specific proxy
       |               ← performs warmup action or promo action
       v
   state.json          ← tracks karma, cooldowns, last action time per account
```

---

## Files to Build (in order)

### 1. `accounts.json` — Account definitions
```json
[
  {
    "id": "acc_1",
    "username": "reddit_username_1",
    "password": "reddit_password_1",
    "proxy": "http://user:pass@residential-proxy-1:port",
    "persona": "tech_enthusiast",
    "subreddits": ["r/programming", "r/webdev", "r/SaaS"],
    "interests": ["Next.js", "developer tools", "productivity"]
  },
  { "id": "acc_2", ... },
  { "id": "acc_3", ... }
]
```

### 2. `content-gen.ts` — Persona-based content via DeepSeek
- 3 distinct persona templates (tech_enthusiast, indie_hacker, curious_learner)
- Takes a subreddit + recent top post title as context
- Returns a natural comment that either:
  - Responds genuinely to the post (warmup)
  - Responds genuinely AND subtly mentions your product (promotion, 1 in 10)

### 3. `browser.ts` — Playwright persistent contexts
- `launchPersistentContext(userDataDir, { proxy })` per account
- Stealth plugin (`playwright-extra` + `puppeteer-extra-plugin-stealth`)
- Functions: `login()`, `browsePosts(subreddit)`, `submitComment(postUrl, text)`, `upvote(postUrl)`
- Human-like delays (1-5s between actions, randomized mouse movements)

### 4. `scheduler.ts` — Main orchestrator
- Runs `npx tsx scheduler.ts` as a long-running process
- Loop: find next account past its cooldown -> pick random subreddit -> run warmup step -> log result
- No overlapping — only 1 account active at a time for 3 accounts
- Saves state to `state.json`

### 5. `state.json` — Account progress tracking
```json
{
  "acc_1": {
    "phase": "commenting",
    "karma": 47,
    "lastAction": "2025-09-15T14:30:00Z",
    "actionsToday": 3,
    "promoCountToday": 0
  }
}
```

---

## Warmup Progression (2 weeks minimum)

| Day | Phase | Action | Max/day |
|-----|-------|--------|---------|
| 1-3 | Lurk | Browse 2-3 subreddits, scroll, click posts, do nothing else | 10-15 page loads |
| 4-7 | Vote | Upvote 3-5 posts, still browse | 5 votes |
| 8-10 | Light comment | 1-2 short genuine comments, no links | 2 comments |
| 11-14 | Normal | 3-5 comments, vote freely, still no promotion | 5 comments |
| 15+ | Active | Normal activity + 1 subtle promo mention per account per WEEK | 1 promo/week |

---

## Promotion Strategy

1. **Only promote from accounts with 50+ karma and 14+ days old**
2. **The comment must be genuinely helpful** — answer the question first, then casually mention your product
3. **Vary the mention format**: "I've been using [product]", "check out [product]", just the name, a feature mention without the name
4. **1 promo per account per week maximum**
5. **Never mention the product in a top-level post** (comments only, and only in relevant threads)
6. **Different URLs**: use different landing pages, UTM params, or URL shorteners per account

---

## Run It

```bash
# Install
cd reddit-agent
pnpm init
pnpm add playwright playwright-extra puppeteer-extra-plugin-stealth openai
pnpm add -D @types/node tsx typescript

# First run — will prompt you to log in manually once per account
# (Reddit's login has bot detection; manual login once via headed browser is safest)
npx tsx scheduler.ts --setup

# Daily run
npx tsx scheduler.ts
```

---

## Notes

- No GoLogin, no complex infra — just 3 Playwright profiles + 3 proxies + DeepSeek
- Accounts never interact with each other (no upvoting each other, no commenting on same posts)
- Each account has a different persona so writing style, tone, and interests look naturally different
- If an account gets shadowbanned or suspended, mark it dead and rotate in a new one