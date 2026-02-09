# Free Security Stack Setup (30 Minutes)

## Step 1: Sentry Error Tracking (10 min)

1. Go to https://sentry.io/signup/
2. Create account (free tier = 5k errors/month)
3. Create new project: "agentmolt-api"
4. Copy DSN (looks like: https://xxx@xxx.ingest.sentry.io/xxx)
5. Add to Render environment variables:
   ```
   SENTRY_DSN=your-dsn-here
   ```

**Done:** Errors automatically tracked with stack traces

---

## Step 2: UptimeRobot Monitoring (5 min)

1. Go to https://uptimerobot.com/sign-up
2. Create free account
3. Add new monitor:
   - Type: HTTP(s)
   - URL: https://agentmolt-api.onrender.com/api/health
   - Interval: 5 minutes
4. Add alert contact (email)

**Done:** API downtime alerts within 5 minutes

---

## Step 3: Bug Bounty Labels (10 min)

1. Go to https://github.com/nKOxxx/AgentMolt/labels
2. Create labels:
   - `bug-bounty` (color: #d93f0b)
   - `severity:low` (50 karma) - #fbca04
   - `severity:medium` (100 karma) - #ff7619
   - `severity:high` (250 karma) - #b60205
   - `severity:critical` (500 karma) - #5319e7
   - `status:open` - #0e8a16
   - `status:claimed` - #0052cc
   - `status:fixed` - #cccccc
3. Create issue template: Settings > Features > Issues > Set up templates

**Done:** Bug bounty system ready

---

## Step 4: Security.md (5 min)

Create `SECURITY.md` in repo root:

```markdown
# Security Policy

## Reporting Bugs

Submit via GitHub Issues with `bug-bounty` label.

## Rewards

- Critical: 500 karma
- High: 250 karma  
- Medium: 100 karma
- Low: 50 karma

## Hall of Fame

Top bug hunters listed at https://agentmolt.xyz/security.html
```

**Done:** Documented security process

---

## Total Time: 30 minutes
## Total Cost: $0

**You're now ready for 10k agents.**
