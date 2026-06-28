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
    const ptDate = new Date().toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", weekday: "short", month: "short", day: "numeric" });
    const ptFull = new Date().toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const ptYMD = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" }); // YYYY-MM-DD in Pacific
    const prompt =
      `You have a web search tool. The 2026 FIFA World Cup is underway. In US Pacific time, today is ${ptFull} (${ptYMD}). ` +
      `Search the web for the latest results AND today's schedule — search several times if needed (e.g. "World Cup 2026 results today", "World Cup 2026 schedule today", specific group fixtures). ` +
      `Then reply with ONLY a single minified JSON object — no prose, no markdown, no backticks. ALWAYS return valid JSON even if nothing has finished yet (use empty arrays). Schema: ` +
      `{"matches":[{"group":"<A-L>","home":"<team>","away":"<team>","homeGoals":<int>,"awayGoals":<int>}],` +
      `"standings":{"<A-L>":{"order":["1st place team","2nd","3rd","4th"],"played":<0-6 matches completed in this group>}},` +
      `"today":[{"date":"<YYYY-MM-DD US Pacific kickoff date>","group":"<A-L or empty>","home":"<team>","away":"<team>","status":"upcoming|live|final","time":"<kickoff in US Pacific like 10:00 AM>","minute":"<e.g. 63'>","homeGoals":<int>,"awayGoals":<int>}],` +
      `"knockout":{"r16":[teams that reached the Round of 16],"qf":[...],"sf":[...],"final":[...],"champion":[...]},` +
      `"r32":[[homeTeam,awayTeam] for each of the 16 Round-of-32 matchups, in bracket order, ONLY once the knockout bracket is officially set after the group stage; otherwise omit or use []],` +
      `"thirds":[up to 8 third-place teams that advanced]}. ` +
      `In "standings" give the CURRENT table order (top to bottom by points, then goal difference, then goals scored) for EVERY group that has played at least one match — use the exact team names, and set "played" to how many of that group's 6 matches are completed. This is the most important field. In "matches" you only need finished matches from the most recent day or two (full-time, with final score) — do NOT list the entire tournament. ` +
      `In "today" list EVERY match whose kickoff date in US Pacific is EXACTLY ${ptYMD} — include matches that already finished earlier today (status "final" with score), matches in progress (status "live" with minute and score), and matches still to come today (status "upcoming"). Set each item's "date" to "${ptYMD}". Do NOT include any match whose Pacific date is not ${ptYMD} (no tomorrow, no yesterday). If no matches fall on ${ptYMD}, use an empty array. ` +
      `Use EXACTLY these team names and the correct group letter for each (group: teams) — ${teamsByGroup}. ` +
      `For knockout arrays, include a team only once it has confirmed reached that round; otherwise []. Reply with only the JSON object.`;

    const ar = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 8000,
        messages: [{ role: "user", content: prompt }],
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 }],
      }),
    });
    const data = await ar.json();
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");

    // surface a real API error (bad model, auth, credit, etc.) instead of a silent "no results"
    if (data.error) {
      return res.status(200).json({ ok: false, error: data.error.message || data.error.type || "Anthropic API error" });
    }

    // ?debug=1 — return what the model actually said (and whether it searched), without changing stored data
    const debugMode = (req.query && (req.query.debug === "1" || req.query.debug === "true")) || String(req.url || "").includes("debug=1");
    if (debugMode) {
      const searchBlocks = (data.content || []).filter((b) => b.type === "server_tool_use" || b.type === "web_search_tool_result").length;
      return res.status(200).json({
        ok: true, debug: true, searchBlocks, stop_reason: data.stop_reason || null,
        apiError: data.error || null, modelText: (text || "").slice(0, 4000),
      });
    }
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

    // groups — compute each group's current table from finished match scores
    let groupsSet = 0;
    const allMatches = Array.isArray(json.matches) ? json.matches : [];
    for (const k of GROUP_KEYS) {
      const teams = GROUPS[k];
      // Primary: use the model's direct standings (compact + reliable, esp. at end of group stage)
      const st = json.standings && json.standings[k];
      if (st && Array.isArray(st.order)) {
        const order = st.order.map(resolveTeam).filter(Boolean);
        const played = Number(st.played);
        if (order.length === 4 && new Set(order).size === 4 && Number.isFinite(played) && played > 0) {
          nextResults[k] = { order, played: Math.min(6, played), total: 6, final: played >= 6 };
          groupsSet++;
          continue;
        }
      }
      // Fallback: compute the table from finished match scores
      const seed = Object.fromEntries(teams.map((t, i) => [t, i]));
      const stat = Object.fromEntries(teams.map((t) => [t, { pts: 0, gd: 0, gf: 0, pl: 0 }]));
      let played = 0;
      for (const m of allMatches) {
        if (String(m.group).toUpperCase() !== k) continue;
        const home = resolveTeam(m.home), away = resolveTeam(m.away);
        const hg = Number(m.homeGoals), ag = Number(m.awayGoals);
        if (!home || !away || !stat[home] || !stat[away]) continue;
        if (!Number.isFinite(hg) || !Number.isFinite(ag)) continue;
        stat[home].gf += hg; stat[home].gd += hg - ag; stat[home].pl++;
        stat[away].gf += ag; stat[away].gd += ag - hg; stat[away].pl++;
        if (hg > ag) stat[home].pts += 3; else if (ag > hg) stat[away].pts += 3; else { stat[home].pts++; stat[away].pts++; }
        played++;
      }
      if (played === 0) continue; // nothing happened in this group yet — leave as-is
      const order = [...teams].sort((a, b) =>
        stat[b].pts - stat[a].pts || stat[b].gd - stat[a].gd || stat[b].gf - stat[a].gf || seed[a] - seed[b]
      );
      nextResults[k] = { order, played, total: 6, final: played >= 6 };
      groupsSet++;
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

    // ---- knockout bracket (Stage 3): seed the 32 + derive results for slot-based scoring ----
    const prevBracketRaw = await kvGet(SUPA_URL, "wc26:bracket", supaHeaders);
    let prevBracket = {}; try { prevBracket = prevBracketRaw ? JSON.parse(prevBracketRaw) : {}; } catch {}
    // parse R32 matchups from the model (16 valid pairs of known teams)
    const r32raw = Array.isArray(json.r32) ? json.r32 : [];
    const r32 = r32raw.map((pair) => {
      if (!Array.isArray(pair) || pair.length !== 2) return null;
      const a = resolveTeam(pair[0]), b = resolveTeam(pair[1]);
      return a && b ? [a, b] : null;
    }).filter(Boolean);
    // only auto-seed when the host hasn't already seeded/corrected a field,
    // AND only once every group is mathematically final (hard gate against premature seeding)
    const haveExistingSeeds = Array.isArray(prevBracket.seeds) && prevBracket.seeds.length === 16;
    const seeds = haveExistingSeeds
      ? prevBracket.seeds
      : (allFinal && r32.length === 16 ? r32 : (prevBracket.seeds || []));
    // results for scoring: reached-sets straight from the knockout data
    const bracketResults = {
      reachedR16: nextKo.actual.r16 || [], reachedQF: nextKo.actual.qf || [],
      reachedSF: nextKo.actual.sf || [], reachedFinal: nextKo.actual.final || [],
      champion: (nextKo.actual.champion || [])[0] || null,
    };
    const hasRealKo = bracketResults.reachedR16.length > 0 || !!bracketResults.champion;
    const nextBracket = {
      seeds,
      locked: !!prevBracket.locked,
      results: hasRealKo ? bracketResults : (prevBracket.results || bracketResults), // don't wipe existing/test results before real knockout data
    };

    // today's matches (validated, team names normalized)
    const todayRaw = (Array.isArray(json.today) ? json.today : []).map((m) => {
      const home = resolveTeam(m.home), away = resolveTeam(m.away);
      if (!home || !away) return null;
      const status = ["upcoming", "live", "final"].includes(m.status) ? m.status : "upcoming";
      const out = { group: typeof m.group === "string" ? m.group.toUpperCase().slice(0, 6) : "", home, away, status };
      if (m.date) out._date = String(m.date).slice(0, 10);
      if (m.time) out.time = String(m.time).slice(0, 12);
      if (status === "live" && m.minute) out.minute = String(m.minute).slice(0, 6);
      if (status !== "upcoming" && Number.isFinite(Number(m.homeGoals)) && Number.isFinite(Number(m.awayGoals))) {
        out.homeGoals = Number(m.homeGoals); out.awayGoals = Number(m.awayGoals);
      }
      return out;
    }).filter(Boolean);
    // keep only matches whose Pacific date is today (undated ones kept as a safety net)
    const todayMatches = todayRaw
      .filter((m) => !m._date || m._date === ptYMD)
      .sort((a, b) => ({ final: 0, live: 1, upcoming: 2 }[a.status] - { final: 0, live: 1, upcoming: 2 }[b.status]))
      .map(({ _date, ...rest }) => rest);
    const todayPayload = { date: ptDate, matches: todayMatches };

    // ---- persist ----
    await kvSet(SUPA_URL, "wc26:results", JSON.stringify(nextResults), supaHeaders);
    await kvSet(SUPA_URL, "wc26:knockout", JSON.stringify(nextKo), supaHeaders);
    await kvSet(SUPA_URL, "wc26:bracket", JSON.stringify(nextBracket), supaHeaders);
    await kvSet(SUPA_URL, "wc26:today", JSON.stringify(todayPayload), supaHeaders);

    return res.status(200).json({ ok: true, groupsSet, koRounds, seeded: seeds.length, todayCount: todayMatches.length, syncedAt: Date.now() });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String((e && e.message) || e) });
  }
}
