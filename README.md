# 🗳️ Election Voting Portal — Vercel Edition

Secure, token-based election voting system. Each voter gets a unique one-time code. Admin manages candidates, generates codes, and watches live results.

---

## Folder Structure

```
voting-system/
├── index.html       ← Full voting portal UI (voter + admin)
├── api/
│   └── vote.js      ← Serverless API (all voting logic)
├── vercel.json      ← Vercel function config
├── package.json     ← Project config
└── README.md
```

---

## Deploy in 3 Steps

### Step 1 — Push to GitHub
1. Create a new **private** GitHub repository
2. Upload all files keeping the exact folder structure above
3. Push to `main`

### Step 2 — Deploy to Vercel
1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Click **Import Git Repository** → select your repo
3. Leave all settings as default → click **Deploy**

Your site is live. Now add the two environment variables below.

### Step 3 — Add Environment Variables
In your Vercel project → **Settings → Environment Variables**, add these 3 variables:

| Key | Value | Where to get it |
|-----|-------|-----------------|
| `UPSTASH_REDIS_REST_URL` | `https://xxx.upstash.io` | [upstash.com](https://upstash.com) — free |
| `UPSTASH_REDIS_REST_TOKEN` | `AXxx...` | Same Upstash console page |
| `ADMIN_PASSWORD` | your chosen password | You decide this |

After adding variables → go to **Deployments → Redeploy**.

---

## Getting a Free Upstash Redis Database

Upstash is a free serverless Redis — no credit card needed.

1. Go to [upstash.com](https://upstash.com) → Sign up free
2. Click **Create Database**
3. Name it `voting`, choose the region closest to you, click **Create**
4. On the database page, scroll to **REST API** section
5. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
6. Paste both into your Vercel environment variables

**Free tier:** 10,000 requests/day — more than enough for any election.

---

## Admin Guide

Once deployed, go to your URL and click **Admin Login**.

| Tab | What you can do |
|-----|----------------|
| **Setup** | Set the poll title, add contestants and their positions |
| **Codes** | Generate voter codes, copy/share links via WhatsApp |
| **Results** | Live vote tally with progress bars per position |

**Workflow:**
1. Set poll title + add all contestants (name + position they're running for)
2. Generate voter codes (one per eligible voter)
3. Share each voter's unique link via WhatsApp
4. Watch results come in live on the Results tab

---

## How Voting Works

- Each voter gets a unique link like `https://your-site.vercel.app?token=ABCD-EFGH`
- They open the link → see the ballot → select one candidate per position → submit
- The code is marked used immediately — cannot vote twice
- Admin sees live results on the Results tab

---

## Making Updates

```bash
git add .
git commit -m "Update"
git push
```

Vercel auto-deploys on every push to `main`.
