// Serverless auto-sync. Calls Anthropic (with web search) to fetch the current
// World Cup results, validates/maps team names, and writes them to the Supabase
// "kv" table — the same keys the app reads (wc26:results, wc26:knockout).
//
// Works as a Vercel function at /api/sync. Can be triggered by the in-app
// "Sync now" button (POST) or by a scheduled cron (GET) — see vercel.json.
//
// Required env vars (set in Vercel project settings, NOT in the browser):
//   ANTHROPIC_API_KEY
//   SUPABASE_URL                 (e.g. https://xxxx.supabase.co)
//   SUPABASE_SERVICE_ROLE_KEY    (server-only secret; bypasses RLS)

const GROUPS = {
  A: ["Mexico", "South Africa", "Korea Republic", "Czechia"],
  B: ["Canada", "Bosnia & Herzegovina", "Qatar", "Switzerland"],
  C: ["Brazil", "Morocco", "Haiti", "Scotland"],
  D: ["United States", "Paraguay", "Australia", "Türkiye"],
  E: ["Germany", "Curaçao", "Ivory Coast", "Ecuador"],
  F: ["Netherlands", "Japan", "Sweden", "Tunisia"],
  G: ["Belgium", "Egypt", "Iran", "New Zealand"],
  H: ["Spain", "Cape Verde", "Saudi Arabia", "Uruguay"],
  I: ["France", "Senegal", "Iraq", "Norway"],
  J: ["Argentina", "Algeria", "Austria", "Jordan"],
  K: ["Portugal", "DR Congo", "Uzbekistan", "Colombia"],
  L: ["England", "Croatia", "Ghana", "Panama"],
};
const GROUP_KEYS = Object.keys(GROUPS);
const KO_ROUNDS = [
  { key: "r16", count: 16 }, { key: "qf", count: 8 }, { key: "sf", count: 4 },
  { key: "final", count: 2 }, { key: "champion", count: 1 },
];
const ALL_TEAMS = Object.values(GROUPS).flat();
const ALIAS = {
  "south korea": "Korea Republic", "korea republic": "Korea Republic", "republic of korea": "Korea Republic",
  "usa": "United States", "us": "United States", "united states": "United States", "united states of america": "United States",
  "turkey": "Türkiye", "turkiye": "Türkiye", "türkiye": "Türkiye",
  "ivory coast": "Ivory Coast", "cote d'ivoire": "Ivory Coast", "côte d'ivoire": "Ivory Coast",
  "czech republic": "Czechia", "czechia": "Czechia",
  "congo dr": "DR Congo", "dr congo": "DR Congo", "democratic republic of the congo": "DR Congo", "democratic republic of congo": "DR Congo",
  "bosnia and herzegovina": "Bosnia & Herzegovina", "bosnia & herzegovina": "Bosnia & Herzegovina", "bosnia": "Bosnia & Herzegovina",
  "cape verde": "Cape Verde", "cabo verde": "Cape Verde",
  "curacao": "Curaçao", "curaçao": "Curaçao",
};
const resolveTeam = (raw) => {
  if (!raw || typeof raw !== "string") return null;
  const key = raw.toLowerCase().trim().replace(/\s+/g, " ");
  if (ALIAS[key]) return ALIAS[key];
  return ALL_TEAMS.find((t) => t.toLowerCase() === key) || null;
};
const emptyKo = () => ({ r16: [], qf: [], sf: [], final: [], champion: [] });
function normalizeKo(ko) {
  const r16 = ko.r16 || [];
  const qf = (ko.qf || []).filter((t) => r16.includes(t));
  const sf = (ko.sf || []).filter((t) => qf.includes(t));
  const fin = (ko.final || []).filter((t) => sf.includes(t));
  const champ = (ko.champion || []).filter((t) => fin.includes(t));
  return { r16, qf, sf, final: fin, champion: champ };
}

// --- tiny Supabase REST helpers (no SDK needed server-side) ---
async function kvGet(base, key, headers) {
  const r = await fetch(`${base}/rest/v1/kv?key=eq.${encodeURIComponent(key)}&select=value`, { headers });
  if (!r.ok) return null;
  const rows = await r.json();
  return rows[0] ? rows[0].value : null;
}
async function kvSet(base, key, value, headers) {
  await fetch(`${base}/rest/v1/kv?on_conflict=key`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
  });
}

export default async function handler(req, res) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const SUPA_URL = process.env.SUPABASE_URL;
    const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!apiKey || !SUPA_URL || !SERVICE) {
      return res.status(500).json({ ok: false, error: "Missing env vars (ANTHROPIC_API_KEY / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)" });
    }
    const supaHeaders = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };

    const teamsByGroup = Object.entries(GROUPS).map(([k, t]) => `${k}: ${t.join(", ")}`).join("; ");
    const prompt =
      `Fetch the CURRENT official 2026 FIFA World Cup results using web search (today is ${new Date().toDateString()}). ` +
      `Return ONLY a minified JSON object, no prose, no markdown. Schema: ` +
      `{"groups":{"A":{"order":[t1,t2,t3,t4],"played":number,"complete":boolean}, ... all 12 groups A-L ...},` +
      `"thirds":[up to 8 third-place teams that advanced to the knockout],` +
      `"knockout":{"r16":[teams that reached the Round of 16],"qf":[teams that reached the Quarter-finals],"sf":[...],"final":[teams that reached the Final],"champion":[the winner]}}. ` +
      `Use EXACTLY these team names (group: teams) — ${teamsByGroup}. ` +
      `"order" is the group table RIGHT NOW, 1st to 4th, by current points/tiebreakers, even if not all matches are played. ` +
      `"played" is how many of that group's 6 matches have finished (0-6). "complete" is true only when played is 6. ` +
      `If a group has not played any match yet, use order:[] and played:0. ` +
      `Only include a knockout team once it has confirmed reached that round; otherwise use []. ` +
      `If the tournament has not started, return every group order:[] played:0 complete:false and all arrays empty. Return only the JSON.`;

    const ar = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
        tools: [{ type: "web_search_20250305", name: "web_search" }],
      }),
    });
    const data = await ar.json();
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    const start = text.indexOf("{"), end = text.lastIndexOf("}");
    // No JSON in the reply usually just means there's nothing to report yet
    // (e.g. before/early in the tournament the model answers in prose). Treat
    // that as a clean "nothing to update" rather than an error.
    if (start < 0 || end < 0) {
      return res.status(200).json({ ok: true, groupsSet: 0, koRounds: 0, note: "no-results-yet", syncedAt: Date.now() });
    }
    let json;
    try {
      json = JSON.parse(text.slice(start, end + 1));
    } catch {
      return res.status(200).json({ ok: true, groupsSet: 0, koRounds: 0, note: "no-results-yet", syncedAt: Date.now() });
    }

    // ---- merge with existing stored state (preserve manual edits not overwritten) ----
    const prevResultsRaw = await kvGet(SUPA_URL, "wc26:results", supaHeaders);
    const prevKoRaw = await kvGet(SUPA_URL, "wc26:knockout", supaHeaders);
    const nextResults = prevResultsRaw ? JSON.parse(prevResultsRaw) : {};
    const prevKo = prevKoRaw ? JSON.parse(prevKoRaw) : { open: false, thirds: [], actual: emptyKo(), finals: {} };
    const nextKo = { ...prevKo, actual: { ...emptyKo(), ...(prevKo.actual || {}) }, finals: { ...(prevKo.finals || {}) } };

    // groups — store the current table (live or final) so the app can project
    let groupsSet = 0;
    for (const k of GROUP_KEYS) {
      const g = json.groups?.[k];
      if (g && Array.isArray(g.order) && g.order.length === 4) {
        const mapped = g.order.map(resolveTeam);
        const ok = mapped.every(Boolean) && new Set(mapped).size === 4 && mapped.every((t) => GROUPS[k].includes(t));
        if (ok) {
          const played = Number.isFinite(g.played) ? g.played : (g.complete ? 6 : undefined);
          nextResults[k] = { order: mapped, final: !!g.complete, total: 6, ...(played != null ? { played } : {}) };
          groupsSet++;
        }
      }
    }

    // knockout
    const thirds = (json.thirds || []).map(resolveTeam).filter(Boolean);
    if (thirds.length === 8) nextKo.thirds = thirds;
    const allFinal = GROUP_KEYS.every((k) => nextResults[k]?.final);
    if (allFinal) nextKo.open = true;
    let koRounds = 0;
    for (const r of KO_ROUNDS) {
      const arr = (json.knockout?.[r.key] || []).map(resolveTeam).filter(Boolean);
      if (arr.length === r.count && new Set(arr).size === r.count) {
        nextKo.actual[r.key] = arr; nextKo.finals[r.key] = true; koRounds++;
      }
    }
    nextKo.actual = normalizeKo(nextKo.actual);

    // ---- persist ----
    await kvSet(SUPA_URL, "wc26:results", JSON.stringify(nextResults), supaHeaders);
    await kvSet(SUPA_URL, "wc26:knockout", JSON.stringify(nextKo), supaHeaders);

    return res.status(200).json({ ok: true, groupsSet, koRounds, syncedAt: Date.now() });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String((e && e.message) || e) });
  }
}
