// ============================================================
//  VOTING SYSTEM — Vercel Serverless API
//  Storage: Upstash Redis (free tier, REST API — no npm needed)
//
//  Set these 3 env vars in Vercel dashboard → Settings → Environment Variables:
//    UPSTASH_REDIS_REST_URL    → from your Upstash console
//    UPSTASH_REDIS_REST_TOKEN  → from your Upstash console
//    ADMIN_PASSWORD            → your chosen admin password
//
//  Get free Upstash Redis at: https://upstash.com
//  (Free tier: 10,000 requests/day — more than enough)
// ============================================================

// ── Upstash Redis REST helpers (no npm install needed) ────────
async function kv(command, ...args) {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are not set. See README for setup instructions.');
  }

  const res = await fetch(`${url}/${command}/${args.map(a => encodeURIComponent(typeof a === 'object' ? JSON.stringify(a) : a)).join('/')}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json();
  if (data.error) throw new Error('Redis error: ' + data.error);
  return data.result;
}

async function kvGet(key) {
  const val = await kv('get', key);
  return val ? JSON.parse(val) : null;
}

async function kvSet(key, value) {
  await kv('set', key, JSON.stringify(value));
}

async function kvDel(key) {
  await kv('del', key);
}

// ── Auth ──────────────────────────────────────────────────────
function checkPw(pw) {
  return pw === (process.env.ADMIN_PASSWORD || 'Admin123');
}

// ── Token generator ───────────────────────────────────────────
function genToken() {
  const ch = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let t = '';
  for (let i = 0; i < 8; i++) {
    if (i === 4) t += '-';
    t += ch[Math.floor(Math.random() * ch.length)];
  }
  return t;
}

// ── Storage helpers ───────────────────────────────────────────
async function getConfig()     { return (await kvGet('poll_config'))  || { pollTitle: '', contestants: [] }; }
async function setConfig(c)    { await kvSet('poll_config', c); }
async function getTokens()     { return (await kvGet('poll_tokens'))  || {}; }
async function setTokens(t)    { await kvSet('poll_tokens', t); }
async function getVotes()      { return (await kvGet('poll_votes'))   || {}; }
async function setVotes(v)     { await kvSet('poll_votes', v); }

// ── API Actions ───────────────────────────────────────────────
async function apiGetConfig() {
  const cfg = await getConfig();
  return { ok: true, pollTitle: cfg.pollTitle, contestants: cfg.contestants };
}

async function apiValidate(rawToken) {
  const token = (rawToken || '').replace(/[^\w-]/g, '').toUpperCase();
  if (!token) return { ok: false, error: 'No voter code provided.' };

  const tokens = await getTokens();
  const cfg    = await getConfig();

  if (!tokens[token])      return { ok: false, error: 'Invalid voter code. Please check and try again.' };
  if (tokens[token].used)  return { ok: false, error: 'This voter code has already been used.' };
  if (!cfg.contestants?.length)
    return { ok: false, error: 'The poll has not been set up yet.' };

  return { ok: true, token, pollTitle: cfg.pollTitle, contestants: cfg.contestants };
}

async function apiVote(rawToken, votesJson) {
  const token = (rawToken || '').replace(/[^\w-]/g, '').toUpperCase();
  if (!token) return { ok: false, error: 'Missing token.' };

  let votesMap;
  try { votesMap = JSON.parse(decodeURIComponent(votesJson || '{}')); }
  catch { return { ok: false, error: 'Invalid vote data.' }; }

  if (!Object.keys(votesMap).length) return { ok: false, error: 'No votes submitted.' };

  const tokens = await getTokens();
  if (!tokens[token])      return { ok: false, error: 'Invalid voter code.' };
  if (tokens[token].used)  return { ok: false, error: 'This code has already been used.' };

  const cfg        = await getConfig();
  const validNames = (cfg.contestants || []).map(c => c.name);
  for (const name of Object.values(votesMap)) {
    if (!validNames.includes(name))
      return { ok: false, error: 'Invalid contestant: ' + name };
  }

  tokens[token] = { used: true, votedFor: votesMap, ts: new Date().toISOString() };
  await setTokens(tokens);

  const votes = await getVotes();
  for (const name of Object.values(votesMap)) {
    votes[name] = (votes[name] || 0) + 1;
  }
  await setVotes(votes);

  return { ok: true, votedFor: votesMap };
}

async function apiAdminLogin(pw) {
  return { ok: checkPw(pw) };
}

async function apiAdminData(pw) {
  if (!checkPw(pw)) return { ok: false, error: 'Wrong password.' };
  const [config, tokens, votes] = await Promise.all([getConfig(), getTokens(), getVotes()]);
  return { ok: true, config, tokens, votes };
}

async function apiSaveConfig(pw, configJson) {
  if (!checkPw(pw)) return { ok: false, error: 'Wrong password.' };
  let cfg;
  try { cfg = JSON.parse(decodeURIComponent(configJson)); }
  catch { return { ok: false, error: 'Invalid config JSON.' }; }
  await setConfig(cfg);
  return { ok: true };
}

async function apiGenTokens(pw, count) {
  if (!checkPw(pw)) return { ok: false, error: 'Wrong password.' };
  const tokens    = await getTokens();
  const newTokens = [];
  for (let i = 0; i < Math.min(count, 200); i++) {
    let t;
    do { t = genToken(); } while (tokens[t]);
    tokens[t] = { used: false, votedFor: null };
    newTokens.push(t);
  }
  await setTokens(tokens);
  return { ok: true, newTokens };
}

async function apiDeleteUnused(pw) {
  if (!checkPw(pw)) return { ok: false, error: 'Wrong password.' };
  const tokens = await getTokens();
  for (const k of Object.keys(tokens)) {
    if (!tokens[k].used) delete tokens[k];
  }
  await setTokens(tokens);
  return { ok: true };
}

async function apiReset(pw) {
  if (!checkPw(pw)) return { ok: false, error: 'Wrong password.' };
  await Promise.all([kvDel('poll_config'), kvDel('poll_tokens'), kvDel('poll_votes')]);
  return { ok: true };
}

// ── Main handler ──────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const p      = req.query || {};
  const action = p.action || '';

  try {
    let result;
    switch (action) {
      case 'config':       result = await apiGetConfig();                                  break;
      case 'validate':     result = await apiValidate(p.token);                            break;
      case 'vote':         result = await apiVote(p.token, p.votes);                       break;
      case 'adminLogin':   result = await apiAdminLogin(p.pw);                             break;
      case 'adminData':    result = await apiAdminData(p.pw);                              break;
      case 'saveConfig':   result = await apiSaveConfig(p.pw, p.config);                  break;
      case 'genTokens':    result = await apiGenTokens(p.pw, parseInt(p.count) || 10);    break;
      case 'deleteUnused': result = await apiDeleteUnused(p.pw);                           break;
      case 'reset':        result = await apiReset(p.pw);                                 break;
      default:             result = { ok: true, msg: 'Voting API is running.' };
    }
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(result);
  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};
