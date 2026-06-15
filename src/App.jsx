import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  GripVertical, Trophy, Check, Users, Save, Info, Copy, RefreshCw, Zap,
  X, Lock, Unlock, Crown, ShieldCheck, RotateCcw, Medal, Flag,
  LogOut, Mail, GitBranch, Pencil, ChevronUp, ChevronDown, ChevronRight, TrendingUp, TrendingDown, Eye, User, Share2, Calendar
} from "lucide-react";

/* ----------------------------- DATA ----------------------------- */
// Official 2026 World Cup groups, listed in seeded (pot) order.
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

const FLAG = {
  "Mexico": "🇲🇽", "South Africa": "🇿🇦", "Korea Republic": "🇰🇷", "Czechia": "🇨🇿",
  "Canada": "🇨🇦", "Bosnia & Herzegovina": "🇧🇦", "Qatar": "🇶🇦", "Switzerland": "🇨🇭",
  "Brazil": "🇧🇷", "Morocco": "🇲🇦", "Haiti": "🇭🇹", "Scotland": "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  "United States": "🇺🇸", "Paraguay": "🇵🇾", "Australia": "🇦🇺", "Türkiye": "🇹🇷",
  "Germany": "🇩🇪", "Curaçao": "🇨🇼", "Ivory Coast": "🇨🇮", "Ecuador": "🇪🇨",
  "Netherlands": "🇳🇱", "Japan": "🇯🇵", "Sweden": "🇸🇪", "Tunisia": "🇹🇳",
  "Belgium": "🇧🇪", "Egypt": "🇪🇬", "Iran": "🇮🇷", "New Zealand": "🇳🇿",
  "Spain": "🇪🇸", "Cape Verde": "🇨🇻", "Saudi Arabia": "🇸🇦", "Uruguay": "🇺🇾",
  "France": "🇫🇷", "Senegal": "🇸🇳", "Iraq": "🇮🇶", "Norway": "🇳🇴",
  "Argentina": "🇦🇷", "Algeria": "🇩🇿", "Austria": "🇦🇹", "Jordan": "🇯🇴",
  "Portugal": "🇵🇹", "DR Congo": "🇨🇩", "Uzbekistan": "🇺🇿", "Colombia": "🇨🇴",
  "England": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "Croatia": "🇭🇷", "Ghana": "🇬🇭", "Panama": "🇵🇦",
};

// NBC Sports power ranking (Joe Prince-Wright, all 48 teams, updated through the tournament)
const RANK = {
  "France": 1, "Spain": 2, "Argentina": 3, "England": 4, "Portugal": 5, "Brazil": 6,
  "Morocco": 7, "Netherlands": 8, "Belgium": 9, "Germany": 10, "Senegal": 11, "Ecuador": 12,
  "Japan": 13, "Türkiye": 14, "Colombia": 15, "Switzerland": 16, "Croatia": 17, "United States": 18,
  "Canada": 19, "Norway": 20, "Uruguay": 21, "Mexico": 22, "Austria": 23, "Scotland": 24,
  "Korea Republic": 25, "Egypt": 26, "Ivory Coast": 27, "Czechia": 28, "Australia": 29, "Paraguay": 30,
  "Sweden": 31, "Iran": 32, "Bosnia & Herzegovina": 33, "Algeria": 34, "Ghana": 35, "Saudi Arabia": 36,
  "South Africa": 37, "Uzbekistan": 38, "Tunisia": 39, "Cape Verde": 40, "DR Congo": 41, "Panama": 42,
  "Qatar": 43, "Haiti": 44, "Iraq": 45, "New Zealand": 46, "Curaçao": 47, "Jordan": 48,
};

// Map common web spellings to the app's canonical team names
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
  const hit = ALL_TEAMS.find((t) => t.toLowerCase() === key);
  return hit || null;
};

/* --------------------------- SCORING ---------------------------- */
// Per group:  +3 each team in exact finishing spot   (max 12)
//             +2 both top-2 teams correct (any order)
//             +3 all 4 positions perfectly correct
//             max 17 / group
const PTS_EXACT = 3, PTS_QUALIFIERS = 2, PTS_PERFECT = 3;

function scoreGroup(pred, actual) {
  let points = 0, exact = 0;
  for (let i = 0; i < 4; i++) if (pred[i] === actual[i]) { points += PTS_EXACT; exact++; }
  const predTop = new Set([pred[0], pred[1]]);
  const qualifiers = [actual[0], actual[1]].every((t) => predTop.has(t));
  if (qualifiers) points += PTS_QUALIFIERS;
  const perfect = exact === 4;
  if (perfect) points += PTS_PERFECT;
  return { points, exact, qualifiers, perfect };
}

/* ------------------------- KNOCKOUT MODEL ----------------------- */
// "Survive each round" predictor. From the 32 qualifiers you pick who reaches
// each round. Points are per correct team that actually reaches that round.
const KO_ROUNDS = [
  { key: "r16", label: "Round of 16", count: 16, pts: 2, color: "#6FB1EC" },
  { key: "qf", label: "Quarter-finals", count: 8, pts: 4, color: "#EE7E76" },
  { key: "sf", label: "Semi-finals", count: 4, pts: 7, color: "#5FC076" },
  { key: "final", label: "Final", count: 2, pts: 12, color: "#EBC25A" },
  { key: "champion", label: "Champion", count: 1, pts: 25, color: "#F4D98A" },
];
const KO_MAX = KO_ROUNDS.reduce((s, r) => s + r.count * r.pts, 0); // 141
const emptyKo = () => ({ r16: [], qf: [], sf: [], final: [], champion: [] });

// keep each round a subset of the previous one
function normalizeKo(ko) {
  const r16 = ko.r16 || [];
  const qf = (ko.qf || []).filter((t) => r16.includes(t));
  const sf = (ko.sf || []).filter((t) => qf.includes(t));
  const fin = (ko.final || []).filter((t) => sf.includes(t));
  const champ = (ko.champion || []).filter((t) => fin.includes(t));
  return { r16, qf, sf, final: fin, champion: champ };
}

// 32 qualifiers: top 2 of every final group + the 8 chosen third-place teams
function poolOf32(results, thirds) {
  if (!results) return [];
  const pool = [];
  for (const k of GROUP_KEYS) {
    const g = results[k];
    if (!g?.final || g.order?.length < 4) return []; // need all groups final
    pool.push(g.order[0], g.order[1]);
  }
  return [...pool, ...(thirds || [])];
}

function scoreKnockout(ko, actual, finals) {
  // actual: same shape; finals: { r16:bool, qf:bool, ... } which rounds count
  let points = 0; const per = {};
  for (const r of KO_ROUNDS) {
    if (!finals?.[r.key]) continue;
    const mine = new Set(ko?.[r.key] || []);
    const real = actual?.[r.key] || [];
    const hits = real.filter((t) => mine.has(t)).length;
    per[r.key] = hits * r.pts;
    points += per[r.key];
  }
  return { points, per };
}

/* --------------------------- STORAGE ---------------------------- */
import { store, storageReady, supabase } from "./store.js";
const PRED_PREFIX = "wc26:pred:";
const RESULTS_KEY = "wc26:results";
const KNOCKOUT_KEY = "wc26:knockout";
const IDENTITY_KEY = "wc26:identity";
const GROUP_PREFIX = "wc26:group:";
const LOCK_KEY = "wc26:locked";
const MOVERS_KEY = "wc26:movers";
const TODAY_KEY = "wc26:today";
const BRACKET_KEY = "wc26:bracket";
const CODE = {
  "France": "FRA", "Spain": "ESP", "Argentina": "ARG", "England": "ENG", "Portugal": "POR", "Brazil": "BRA",
  "Morocco": "MAR", "Netherlands": "NED", "Belgium": "BEL", "Germany": "GER", "Senegal": "SEN", "Ecuador": "ECU",
  "Japan": "JPN", "Türkiye": "TUR", "Colombia": "COL", "Switzerland": "SUI", "Croatia": "CRO", "United States": "USA",
  "Canada": "CAN", "Norway": "NOR", "Uruguay": "URU", "Mexico": "MEX", "Austria": "AUT", "Scotland": "SCO",
  "Korea Republic": "KOR", "Egypt": "EGY", "Ivory Coast": "CIV", "Czechia": "CZE", "Australia": "AUS", "Paraguay": "PAR",
  "Sweden": "SWE", "Iran": "IRN", "Bosnia & Herzegovina": "BIH", "Algeria": "ALG", "Ghana": "GHA", "Saudi Arabia": "KSA",
  "South Africa": "RSA", "Uzbekistan": "UZB", "Tunisia": "TUN", "Cape Verde": "CPV", "DR Congo": "COD", "Panama": "PAN",
  "Qatar": "QAT", "Haiti": "HAI", "Iraq": "IRQ", "New Zealand": "NZL", "Curaçao": "CUW", "Jordan": "JOR",
};
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
const genCode = () => Array.from({ length: 5 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");
// Only these accounts can open the Results (host) tab. Set in .env / Vercel:
//   VITE_ADMIN_EMAILS=you@example.com   (comma-separated for more than one)
const ADMIN_EMAILS = ((import.meta.env && import.meta.env.VITE_ADMIN_EMAILS) || "")
  .toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
const slug = (n) => n.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "anon";
const freshPicks = () => Object.fromEntries(GROUP_KEYS.map((k) => [k, [...GROUPS[k]]]));
const newToken = () => {
  try { if (crypto?.randomUUID) return crypto.randomUUID(); } catch {}
  return "t-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
};

/* ----------------------------- UI ------------------------------- */
const C = {
  bg: "#FBFAF7", panel: "rgba(255,255,255,0.72)", panel2: "rgba(20,20,25,0.04)", line: "rgba(20,20,25,0.13)",
  text: "#1A1712", mute: "#6E6A60", green: "#C8901C", greenDim: "#B08D3A",
  gold: "#C8901C", coral: "#D9544A", blue: "#3E8FD6",
  grad: "linear-gradient(135deg,#F3D27A 0%,#E8B84B 55%,#C99A3B 100%)",
  navbg: "rgba(251,250,247,.78)", soft: "rgba(20,20,25,.055)", scrim: "rgba(20,20,25,.2)", chip: "#fff", card: "rgba(255,255,255,.97)", pos: "#3E9E5E",
};
const GRAD_SHADOW = "0 12px 30px rgba(200,144,28,.30)";

function Styles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
      * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
      .wc-root { font-family: 'Plus Jakarta Sans', sans-serif; -webkit-font-smoothing: antialiased; }
      .wc-display { font-family: 'Bricolage Grotesque', sans-serif; font-weight: 800; letter-spacing: -.02em; }
      .wc-mono { font-family: 'Space Mono', monospace; }
      .wc-grad-text {
        background: linear-gradient(135deg,#D9A93F 0%,#BE861F 55%,#8E5E12 100%);
        -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent;
      }
      .wc-aurora {
        background-color: #FBFAF7;
        background-image:
          radial-gradient(680px 480px at 10% -8%, rgba(232,184,75,.22), transparent 60%),
          radial-gradient(640px 480px at 102% 2%, rgba(62,143,214,.08), transparent 55%),
          radial-gradient(820px 700px at 50% 116%, rgba(217,84,74,.07), transparent 60%);
        background-attachment: fixed;
      }
      .wc-glass { backdrop-filter: blur(16px) saturate(140%); -webkit-backdrop-filter: blur(16px) saturate(140%); }
      .wc-fade { animation: wcFade .4s cubic-bezier(.2,.7,.2,1) both; }
      @keyframes wcFade { from { opacity:0; transform: translateY(10px);} to {opacity:1; transform:none;} }
      .wc-pop { animation: wcPop .28s cubic-bezier(.2,.9,.3,1.4) both; }
      @keyframes wcPop { from { transform: scale(.95); opacity:.4;} to { transform:none; opacity:1;} }
      .wc-btn { transition: transform .14s cubic-bezier(.2,.8,.3,1), filter .18s, background .18s, border-color .18s, opacity .18s; }
      .wc-btn:active { transform: scale(.95); }
      .wc-tab { transition: color .2s, background .2s, box-shadow .2s; }
      .wc-row { transition: transform .2s cubic-bezier(.2,.8,.3,1), background .22s, border-color .22s; }
      .wc-shine { background-size: 220% auto; animation: wcShine 4.5s linear infinite; }
      @keyframes wcShine { to { background-position: 220% center; } }
      .wc-glow { animation: wcGlow 3.2s ease-in-out infinite; }
      @keyframes wcGlow { 0%,100% { filter: drop-shadow(0 0 0 rgba(200,144,28,0)); } 50% { filter: drop-shadow(0 0 14px rgba(200,144,28,.28)); } }
      .wc-marquee { display: flex; gap: 16px; width: max-content; animation: wcMarquee 30s linear infinite; }
      @keyframes wcMarquee { to { transform: translateX(-50%); } }
      .wc-hero-card { transition: transform .18s cubic-bezier(.2,.8,.3,1), border-color .2s; }
      .wc-hero-card:hover { transform: translateY(-3px); }
      .wc-spin { animation: wcSpin 1s linear infinite; }
      @keyframes wcSpin { to { transform: rotate(360deg); } }
      .wc-pulse { width: 7px; height: 7px; border-radius: 99px; background: #3E9E5E; animation: wcPulse 1.6s infinite; display: inline-block; }
      @keyframes wcPulse { 0%{ box-shadow:0 0 0 0 rgba(62,158,94,.55);} 70%{ box-shadow:0 0 0 7px rgba(62,158,94,0);} 100%{ box-shadow:0 0 0 0 rgba(62,158,94,0);} }
      input { font-family: inherit; }
      input:focus { outline: none; }
      ::-webkit-scrollbar { width: 9px; height: 9px; }
      ::-webkit-scrollbar-thumb { background: rgba(20,20,25,.2); border-radius: 8px; }
    `}</style>
  );
}

function PosBadge({ n, advancing }) {
  const color = advancing ? C.green : C.mute;
  return (
    <div className="wc-mono" style={{
      width: 30, height: 30, flexShrink: 0, display: "grid", placeItems: "center",
      fontSize: 16, fontWeight: 700, color,
      border: `1.5px solid ${advancing ? C.green : C.line}`,
      borderRadius: 8, background: advancing ? "rgba(232,184,75,.08)" : "transparent",
    }}>{n}</div>
  );
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Drag-and-drop reorder list. Positions are fixed slots (1–4) with the advance
// line between slot 2 and 3; you drag team cards between them via the grip handle.
const STEP = 58, CARD_H = 46, LINE_H = 30;
const topFor = (slot) => slot * STEP + (slot >= 2 ? LINE_H : 0);
const LINE_TOP = topFor(1) + CARD_H + 6;
const CONTAINER_H = topFor(3) + CARD_H;

function DragList({ items, onReorder, editable }) {
  const [drag, setDrag] = useState(null); // { index, dy, startY }

  // provisional order while dragging
  let prov = items, target = null;
  if (drag) {
    target = clamp(drag.index + Math.round(drag.dy / STEP), 0, items.length - 1);
    prov = [...items];
    const [m] = prov.splice(drag.index, 1);
    prov.splice(target, 0, m);
  }

  const onDown = (e, index) => {
    if (!editable) return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    setDrag({ index, dy: 0, startY: e.clientY });
  };
  const onMove = (e) => {
    setDrag((d) => (d ? { ...d, dy: e.clientY - d.startY } : d));
  };
  const onUp = (e) => {
    setDrag((d) => {
      if (d) {
        const t = clamp(d.index + Math.round(d.dy / STEP), 0, items.length - 1);
        if (t !== d.index) {
          const next = [...items];
          const [m] = next.splice(d.index, 1);
          next.splice(t, 0, m);
          onReorder(next);
        }
      }
      return null;
    });
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
  };

  return (
    <div style={{ position: "relative", height: CONTAINER_H }}>
      {/* advance line — fixed between slots 2 and 3 */}
      <div style={{ position: "absolute", left: 0, right: 0, top: LINE_TOP, height: LINE_H - 12, display: "flex", alignItems: "center", gap: 8, padding: "0 2px", pointerEvents: "none" }}>
        <div style={{ flex: 1, height: 1, background: `repeating-linear-gradient(90deg, ${C.greenDim} 0 6px, transparent 6px 12px)` }} />
        <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: ".12em", color: C.greenDim }}>ADVANCE LINE</span>
        <div style={{ flex: 1, height: 1, background: `repeating-linear-gradient(90deg, ${C.greenDim} 0 6px, transparent 6px 12px)` }} />
      </div>

      {items.map((team) => {
        const isDragging = drag && items[drag.index] === team;
        const slot = prov.indexOf(team);
        const advancing = slot < 2;
        const top = isDragging ? topFor(drag.index) + drag.dy : topFor(slot);
        return (
          <div key={team} className="wc-row" style={{
            position: "absolute", left: 0, right: 0, top, height: CARD_H,
            display: "flex", alignItems: "center", gap: 10, padding: "0 8px 0 8px",
            background: advancing ? "rgba(232,184,75,.06)" : C.soft,
            borderRadius: 12, border: `1px solid ${advancing ? "rgba(232,184,75,.22)" : C.line}`,
            transition: isDragging ? "none" : "top .22s cubic-bezier(.2,.8,.3,1), background .2s, border-color .2s",
            zIndex: isDragging ? 30 : 1,
            transform: isDragging ? "scale(1.03)" : "none",
            boxShadow: isDragging ? "0 14px 32px rgba(20,20,25,.14)" : "none",
            touchAction: isDragging ? "none" : "auto",
          }}>
            <PosBadge n={slot + 1} advancing={advancing} />
            <span style={{ fontSize: 22, width: 26, textAlign: "center", flexShrink: 0 }}>{FLAG[team] || "🏳️"}</span>
            <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{team}</span>
              {RANK[team] && <span className="wc-mono" style={{ fontSize: 10.5, fontWeight: 700, color: C.mute, opacity: .55, flexShrink: 0 }}>#{RANK[team]}</span>}
            </div>
            {editable && (
              <div
                onPointerDown={(e) => onDown(e, items.indexOf(team))}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
                role="button" aria-label={`Drag ${team}`}
                style={{
                  flexShrink: 0, width: 40, height: CARD_H, display: "grid", placeItems: "center",
                  color: isDragging ? C.green : C.mute, cursor: isDragging ? "grabbing" : "grab",
                  touchAction: "none", marginRight: -4,
                }}>
                <GripVertical size={20} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TodayMatches({ data }) {
  const matches = data?.matches;
  if (!Array.isArray(matches) || matches.length === 0) return null;
  const tcode = (t) => CODE[t] || t;
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, margin: "0 2px 9px", color: C.mute }}>
        <Calendar size={14} />
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".12em" }}>TODAY'S MATCHES{data.date ? ` · ${data.date}` : ""}</span>
      </div>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6 }}>
        {matches.map((m, i) => {
          const live = m.status === "live", final = m.status === "final";
          const hw = (live || final) && m.homeGoals > m.awayGoals;
          const aw = (live || final) && m.awayGoals > m.homeGoals;
          return (
            <div key={i} className="wc-glass" style={{ flex: "0 0 auto", width: 152, background: C.panel, border: `1px solid ${live ? C.green : C.line}`, borderRadius: 14, padding: "11px 12px", boxShadow: "0 6px 16px rgba(20,20,25,.05)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".06em", color: C.gold }}>{m.group ? `GROUP ${m.group}` : "MATCH"}</span>
                {live ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9.5, fontWeight: 800, color: C.green }}><span className="wc-pulse" />{m.minute ? ` ${m.minute}` : " LIVE"}</span>
                ) : final ? (
                  <span style={{ fontSize: 9.5, fontWeight: 800, color: C.mute }}>FULL TIME</span>
                ) : (
                  <span style={{ fontSize: 9.5, fontWeight: 800, color: C.blue }}>{m.time ? `${m.time} PT` : "TBD"}</span>
                )}
              </div>
              {[["home", hw], ["away", aw]].map(([side, win], idx) => (
                <div key={side}>
                  {idx === 1 && <div style={{ height: 1, background: C.line, margin: "7px 0" }} />}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, opacity: (live || final) && !win && (idx === 0 ? aw : hw) ? .5 : 1 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 17 }}>{FLAG[m[side]] || "🏳️"}</span>
                      <span style={{ fontWeight: win ? 800 : 700, fontSize: 13.5 }}>{tcode(m[side])}</span>
                    </span>
                    {(live || final) && <span className="wc-mono" style={{ fontWeight: 800, fontSize: 15 }}>{idx === 0 ? m.homeGoals : m.awayGoals}</span>}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: 10.5, color: C.mute, margin: "6px 2px 0", opacity: .8 }}>Kickoff times in US Pacific (PT).</p>
    </div>
  );
}

function PickRow({ order }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
      {order.map((t, i) => (
        <span key={t} style={{
          display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12, padding: "3px 7px", borderRadius: 8,
          background: i < 2 ? "rgba(232,184,75,.16)" : C.panel2,
          border: `1px solid ${i < 2 ? "rgba(200,144,28,.4)" : C.line}`,
          fontWeight: i < 2 ? 800 : 600, color: i < 2 ? C.text : C.mute,
        }}>
          <span style={{ fontSize: 13 }}>{FLAG[t]}</span>{t}
        </span>
      ))}
    </div>
  );
}

const BR_ROUNDS = ["Round of 32", "Round of 16", "Quarterfinals", "Semifinals", "Final"];
const BR_COUNTS = [16, 8, 4, 2, 1];
const BR_TOTAL = 31;
function brSanitize(p) {
  const out = { ...p };
  for (let r = 1; r < 5; r++) {
    for (let m = 0; m < BR_COUNTS[r]; m++) {
      const a = out[`${r - 1}_${2 * m}`], b = out[`${r - 1}_${2 * m + 1}`];
      const key = `${r}_${m}`;
      if (out[key] && out[key] !== a && out[key] !== b) delete out[key];
    }
  }
  return out;
}
const brCompetitors = (seeds, p, r, m) => (r === 0 ? (seeds[m] || [null, null]) : [p[`${r - 1}_${2 * m}`], p[`${r - 1}_${2 * m + 1}`]]);
// sample field for host testing before the real 32 are known
const SAMPLE_BRACKET = [
  ["France", "Senegal"], ["Japan", "Mexico"], ["Spain", "Uruguay"], ["Croatia", "United States"],
  ["Argentina", "Morocco"], ["Netherlands", "Germany"], ["England", "Belgium"], ["Portugal", "Brazil"],
  ["Norway", "Ecuador"], ["Colombia", "Switzerland"], ["Canada", "Egypt"], ["Korea Republic", "Austria"],
  ["Türkiye", "Iran"], ["Ghana", "Australia"], ["Paraguay", "Sweden"], ["Scotland", "Uzbekistan"],
];

// slot-based bracket scoring: a pick scores if that team actually reached that round
function scoreBracket(koBracket, results) {
  if (!koBracket || !results) return 0;
  const PTS = [3, 5, 9, 16];
  const reached = [results.reachedR16, results.reachedQF, results.reachedSF, results.reachedFinal].map((a) => new Set(a || []));
  let total = 0;
  for (let r = 0; r < 4; r++) {
    for (let m = 0; m < BR_COUNTS[r]; m++) {
      const t = koBracket[`${r}_${m}`];
      if (t && reached[r].has(t)) total += PTS[r];
    }
  }
  const champPick = koBracket["4_0"];
  if (champPick && results.champion && champPick === results.champion) total += 30; // champion wins it all (any opponent)
  const f1 = koBracket["3_0"], f2 = koBracket["3_1"]; // your two predicted finalists
  const finalSet = new Set(results.reachedFinal || []);
  if (f1 && f2 && finalSet.has(f1) && finalSet.has(f2)) total += 18; // nailed BOTH finalists (regardless of winner)
  return total;
}
// deterministic sample actual-results (higher power rank advances) — for host testing only
function sampleResults(seeds) {
  const better = (a, b) => ((RANK[a] || 99) <= (RANK[b] || 99) ? a : b);
  const nextRound = (arr) => { const out = []; for (let i = 0; i < arr.length; i += 2) out.push(better(arr[i], arr[i + 1])); return out; };
  const reachedR16 = seeds.map(([a, b]) => better(a, b));
  const reachedQF = nextRound(reachedR16);
  const reachedSF = nextRound(reachedQF);
  const reachedFinal = nextRound(reachedSF);
  const champion = nextRound(reachedFinal)[0];
  return { reachedR16, reachedQF, reachedSF, reachedFinal, champion };
}

function BracketColumns({ seeds, picks, onPick, locked }) {
  const [r, setR] = useState(0);
  const champ = picks["4_0"];
  const made = Object.keys(picks).filter((k) => picks[k]).length;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: C.panel, border: `1px solid ${champ ? C.gold : C.line}`, borderRadius: 14, padding: "11px 14px", marginBottom: 12, boxShadow: "0 6px 18px rgba(20,20,25,.05)" }}>
        <Trophy size={20} color={C.gold} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".1em", color: C.mute }}>YOUR CHAMPION</div>
          <div style={{ fontWeight: 800, fontSize: 16, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{champ ? `${FLAG[champ] || ""} ${champ}` : "—"}</div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div className="wc-mono" style={{ fontWeight: 800, fontSize: 15, color: made === BR_TOTAL ? C.pos : C.text }}>{made}/{BR_TOTAL}</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.mute }}>picks</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 14, paddingBottom: 4 }}>
        {BR_ROUNDS.map((rn, i) => {
          const done = Object.keys(picks).filter((k) => k.startsWith(`${i}_`) && picks[k]).length;
          const full = done === BR_COUNTS[i];
          return (
            <button key={rn} className="wc-btn" onClick={() => setR(i)} style={{
              flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 999, border: "none", cursor: "pointer", fontWeight: 800, fontSize: 12,
              background: r === i ? C.grad : "transparent", color: r === i ? "#201700" : C.mute, boxShadow: r === i ? GRAD_SHADOW : "none",
            }}>{rn}{full && <Check size={13} color={r === i ? "#201700" : C.pos} />}</button>
          );
        })}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {Array.from({ length: BR_COUNTS[r] }).map((_, m) => {
          const [a, b] = brCompetitors(seeds, picks, r, m);
          const pick = picks[`${r}_${m}`];
          return (
            <div key={m} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 8, boxShadow: "0 6px 16px rgba(20,20,25,.05)" }}>
              <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: ".1em", color: C.mute, padding: "2px 4px 7px" }}>{r === 4 ? "THE FINAL" : `MATCH ${m + 1}`}</div>
              {[a, b].map((team, s) => {
                if (!team) {
                  return (
                    <div key={s} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, border: `1px dashed ${C.line}`, color: C.mute, fontSize: 12.5, fontWeight: 600, marginTop: s ? 6 : 0, opacity: .8 }}>
                      Pick Match {2 * m + s + 1} in {BR_ROUNDS[r - 1]} first
                    </div>
                  );
                }
                const on = pick === team;
                return (
                  <button key={s} className="wc-btn" disabled={locked} onClick={() => !locked && onPick(r, m, team)} style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "11px 12px", borderRadius: 10, cursor: locked ? "default" : "pointer", width: "100%", textAlign: "left", marginTop: s ? 6 : 0,
                    border: `1px solid ${on ? C.gold : C.line}`, background: on ? "rgba(232,184,75,.16)" : "transparent",
                    fontWeight: on ? 800 : 600, fontSize: 14.5, color: C.text, opacity: locked && !on ? .55 : 1,
                  }}>
                    <span style={{ fontSize: 19 }}>{FLAG[team] || "🏳️"}</span>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{team}</span>
                    {on && <Check size={16} color={C.gold} />}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {!locked && r < 4 && Object.keys(picks).filter((k) => k.startsWith(`${r}_`) && picks[k]).length === BR_COUNTS[r] && (
        <button className="wc-btn" onClick={() => setR(r + 1)} style={{
          width: "100%", marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          background: C.grad, color: "#201700", border: "none", borderRadius: 12, padding: "13px", fontWeight: 800, fontSize: 14, cursor: "pointer", boxShadow: GRAD_SHADOW,
        }}>Next: {BR_ROUNDS[r + 1]} <ChevronRight size={16} /></button>
      )}
    </div>
  );
}

function GroupCard({ gk, order, onReorder, editable, headerRight, scored }) {
  return (
    <div className="wc-fade wc-glass" style={{
      background: C.panel, border: `1px solid ${C.line}`, borderRadius: 20, padding: 15,
      boxShadow: "0 8px 24px rgba(20,20,25,.09)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="wc-display" style={{ fontSize: 30, lineHeight: 1, color: C.text }}>{gk}</span>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".14em", color: C.mute, textTransform: "uppercase" }}>Group</span>
        </div>
        {headerRight}
      </div>
      <DragList items={order} onReorder={(next) => onReorder(gk, next)} editable={editable} />
      {scored != null && (
        <div className="wc-mono" style={{ marginTop: 10, textAlign: "right", fontSize: 13, color: C.gold, fontWeight: 700 }}>
          +{scored} pts
        </div>
      )}
    </div>
  );
}

function PhaseToggle({ phase, setPhase, koLocked }) {
  const Btn = ({ id, label }) => {
    const active = phase === id;
    const locked = id === "knockout" && koLocked;
    return (
      <button className="wc-btn" onClick={() => !locked && setPhase(id)} style={{
        flex: 1, padding: "11px 8px", borderRadius: 12, border: "none",
        cursor: locked ? "default" : "pointer", fontWeight: 800, fontSize: 13.5,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        background: active ? C.grad : "transparent", color: active ? "#201700" : (locked ? "rgba(139,157,150,.5)" : C.mute),
        boxShadow: active ? GRAD_SHADOW : "none",
      }}>
        {locked && <Lock size={13} />} {label}
      </button>
    );
  };
  return (
    <div className="wc-glass" style={{ display: "flex", gap: 5, padding: 5, background: C.soft, border: `1px solid ${C.line}`, borderRadius: 16, marginBottom: 16 }}>
      <Btn id="group" label="Group Stage" />
      <Btn id="knockout" label="Knockout" />
    </div>
  );
}

function KnockoutBoard({ pool, ko, onToggle, editable, showFinals, finals, onToggleFinal, notReadyMsg }) {
  if (!pool || pool.length < 32) {
    return (
      <div className="wc-glass" style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, padding: 20, textAlign: "center", color: C.mute }}>
        <Lock size={26} style={{ margin: "0 auto", opacity: .7 }} />
        <p style={{ marginTop: 10, fontSize: 13.5, fontWeight: 600 }}>{notReadyMsg || "The knockout bracket unlocks once all 12 group results are final."}</p>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {KO_ROUNDS.map((r, i) => {
        const prev = i === 0 ? null : KO_ROUNDS[i - 1];
        const candidates = i === 0 ? pool : (ko[prev.key] || []);
        const selected = ko[r.key] || [];
        const done = selected.length === r.count;
        const isFinal = showFinals && finals?.[r.key];
        return (
          <div key={r.key} className="wc-fade wc-glass" style={{
            background: C.panel, border: `1px solid ${isFinal ? "rgba(232,184,75,.4)" : C.line}`, borderRadius: 20, padding: 15,
            boxShadow: "0 8px 24px rgba(20,20,25,.09)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: r.color, flexShrink: 0 }} />
              <span className="wc-display" style={{ fontSize: 19 }}>{r.label}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: r.color }}>+{r.pts} each</span>
              <span className="wc-mono" style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: done ? C.green : C.mute }}>
                {selected.length}/{r.count}
              </span>
              {showFinals && (
                <button className="wc-btn" onClick={() => onToggleFinal(r.key)} style={{
                  display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 800,
                  padding: "5px 9px", borderRadius: 999, cursor: "pointer",
                  border: `1px solid ${isFinal ? C.green : C.line}`,
                  background: isFinal ? "rgba(232,184,75,.12)" : "transparent",
                  color: isFinal ? C.green : C.mute,
                }}>{isFinal ? <Lock size={12} /> : <Unlock size={12} />}{isFinal ? "Official" : "Mark official"}</button>
              )}
            </div>
            {candidates.length === 0 ? (
              <div style={{ color: C.mute, fontSize: 12.5, fontWeight: 600, padding: "4px 2px" }}>
                Pick your {prev.label} first to choose from them here.
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {candidates.map((team) => {
                  const on = selected.includes(team);
                  const full = !on && selected.length >= r.count;
                  return (
                    <button key={team} className="wc-btn" disabled={!editable || full}
                      onClick={() => onToggle(r.key, team)}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 12px",
                        borderRadius: 999, fontSize: 13.5, fontWeight: 700, cursor: editable && !full ? "pointer" : "default",
                        border: `1px solid ${on ? r.color : C.line}`,
                        background: on ? r.color : C.soft,
                        color: on ? "#201700" : (full ? "rgba(139,157,150,.5)" : C.text),
                        opacity: full ? .5 : 1,
                      }}>
                      <span style={{ fontSize: 16 }}>{FLAG[team] || "🏳️"}</span>{team}
                      {on && <Check size={14} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TrackerCard({ teamsLeft, matchesLeft, matchesPlayed, stageLabel, survivors, compact }) {
  const pct = Math.round((matchesPlayed / 104) * 100);
  return (
    <div className="wc-glass" style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, padding: 16, marginBottom: 16, boxShadow: "0 8px 24px rgba(20,20,25,.07)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: C.gold, boxShadow: `0 0 0 4px rgba(232,184,75,.18)` }} />
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".16em", color: C.mute }}>TOURNAMENT TRACKER</span>
        <span style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 800, color: C.gold }}>{stageLabel}</span>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        {[["Teams left", teamsLeft, 48], ["Matches left", matchesLeft, 104]].map(([label, val, total]) => (
          <div key={label} style={{ flex: 1, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 14, padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
              <span className="wc-mono" style={{ fontSize: 30, fontWeight: 700, color: C.text, lineHeight: 1 }}>{val}</span>
              <span className="wc-mono" style={{ fontSize: 13, fontWeight: 700, color: C.mute }}>/ {total}</span>
            </div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".06em", color: C.mute, marginTop: 6 }}>{label.toUpperCase()}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <div style={{ height: 7, borderRadius: 999, background: C.panel2, overflow: "hidden", border: `1px solid ${C.line}` }}>
          <div style={{ width: `${pct}%`, height: "100%", background: C.grad, transition: "width .5s cubic-bezier(.2,.8,.3,1)" }} />
        </div>
        <div style={{ fontSize: 11, color: C.mute, fontWeight: 600, marginTop: 6 }}>
          {matchesPlayed} of 104 matches played · {pct}% complete
        </div>
      </div>
      {!compact && survivors && survivors.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".12em", color: C.mute, marginBottom: 8 }}>
            {teamsLeft === 1 ? "CHAMPION" : "STILL ALIVE"}
          </div>
          {survivors.length <= 16 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {survivors.map((t) => (
                <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.panel2, border: `1px solid ${teamsLeft === 1 ? C.gold : C.line}`, borderRadius: 999, padding: "5px 11px", fontSize: 12.5, fontWeight: 700 }}>
                  <span style={{ fontSize: 15 }}>{FLAG[t] || "🏳️"}</span>{t}
                </span>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, fontSize: 22, lineHeight: 1.1 }}>
              {survivors.map((t) => <span key={t} title={t}>{FLAG[t] || "🏳️"}</span>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AuthGate({ mode, setMode, email, setEmail, pw, setPw, error, notice, busy, onSignIn, onSignUp, onForgot, ready }) {
  const isSignup = mode === "signup";
  const submit = () => (isSignup ? onSignUp() : onSignIn());
  const inputStyle = { width: "100%", marginTop: 6, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 12px", color: C.text, fontSize: 15, fontWeight: 600 };
  return (
    <div className="wc-fade wc-glass" style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 22, padding: 22, maxWidth: 420, margin: "8px auto", boxShadow: "0 10px 30px rgba(20,20,25,.08)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: C.grad, display: "grid", placeItems: "center", boxShadow: GRAD_SHADOW }}>
          <Trophy size={20} color="#201700" />
        </div>
        <div>
          <div className="wc-display" style={{ fontSize: 22, lineHeight: 1 }}>{isSignup ? "Create account" : "Sign in"}</div>
          <div style={{ fontSize: 12, color: C.mute, fontWeight: 600 }}>to play the World Cup Predictor</div>
        </div>
      </div>
      {!ready && (
        <p style={{ fontSize: 12, color: C.coral, fontWeight: 700, margin: "10px 0 0" }}>
          Add your Supabase keys to .env to enable accounts.
        </p>
      )}
      <div style={{ marginTop: 14 }}>
        <label style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".12em", color: C.mute, display: "flex", alignItems: "center", gap: 6 }}><Mail size={13} /> EMAIL</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} />
      </div>
      <div style={{ marginTop: 12 }}>
        <label style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".12em", color: C.mute, display: "flex", alignItems: "center", gap: 6 }}><Lock size={13} /> PASSWORD</label>
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••"
          onKeyDown={(e) => e.key === "Enter" && submit()} style={inputStyle} />
      </div>
      {error && <p style={{ fontSize: 12, color: C.coral, fontWeight: 700, margin: "10px 0 0" }}>{error}</p>}
      {notice && <p style={{ fontSize: 12, color: C.green, fontWeight: 700, margin: "10px 0 0" }}>{notice}</p>}
      <button className="wc-btn" onClick={submit} disabled={busy || !ready || !email.trim() || !pw} style={{
        width: "100%", marginTop: 16, background: C.grad, color: "#201700", border: "none", borderRadius: 12,
        padding: "14px", fontWeight: 800, fontSize: 15, cursor: busy ? "default" : "pointer", boxShadow: GRAD_SHADOW,
        opacity: busy || !ready || !email.trim() || !pw ? .6 : 1,
      }}>{busy ? "…" : isSignup ? "Create account" : "Sign in"}</button>
      <button className="wc-btn" onClick={() => setMode(isSignup ? "signin" : "signup")} style={{
        width: "100%", marginTop: 10, background: "transparent", color: C.mute, border: "none", fontWeight: 700, fontSize: 12.5, cursor: "pointer",
      }}>{isSignup ? "Already have an account? Sign in" : "New here? Create an account"}</button>
      {!isSignup && (
        <button className="wc-btn" onClick={() => onForgot()} disabled={busy} style={{
          width: "100%", marginTop: 2, background: "transparent", color: C.blue, border: "none", fontWeight: 700, fontSize: 12.5, cursor: "pointer",
        }}>Forgot password?</button>
      )}
    </div>
  );
}

function BracketView({ koPool, actual, finals, myPicks, koOpen }) {
  const [mode, setMode] = useState("actual");
  const ready = koPool && koPool.length === 32;
  if (!ready) {
    return (
      <div className="wc-fade wc-glass" style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, padding: 20, textAlign: "center", color: C.mute }}>
        <GitBranch size={26} style={{ margin: "0 auto", opacity: .7 }} />
        <p style={{ marginTop: 10, fontSize: 13.5, fontWeight: 600 }}>The bracket appears once all 12 groups are final and the 32 qualifiers are set.</p>
      </div>
    );
  }
  const src = mode === "actual" ? (actual || {}) : (myPicks || {});
  const cols = [
    { key: "r32", label: "Round of 32", teams: koPool, color: C.mute },
    { key: "r16", label: "Round of 16", teams: src.r16 || [], color: "#6FB1EC" },
    { key: "qf", label: "Quarter-finals", teams: src.qf || [], color: "#EE7E76" },
    { key: "sf", label: "Semi-finals", teams: src.sf || [], color: "#5FC076" },
    { key: "final", label: "Final", teams: src.final || [], color: "#EBC25A" },
    { key: "champion", label: "Champion", teams: src.champion || [], color: C.gold },
  ];
  return (
    <div className="wc-fade">
      <div className="wc-glass" style={{ display: "flex", gap: 5, padding: 5, background: C.soft, border: `1px solid ${C.line}`, borderRadius: 16, marginBottom: 14 }}>
        {[["actual", "Actual results"], ["mine", "My picks"]].map(([id, label]) => (
          <button key={id} className="wc-btn" onClick={() => setMode(id)} style={{
            flex: 1, padding: "10px 8px", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 800, fontSize: 13,
            background: mode === id ? C.grad : "transparent", color: mode === id ? "#201700" : C.mute,
            boxShadow: mode === id ? GRAD_SHADOW : "none",
          }}>{label}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8 }}>
        {cols.map((col) => (
          <div key={col.key} style={{ flex: "0 0 auto", width: col.key === "r32" ? 168 : 150 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, position: "sticky", top: 0 }}>
              <span style={{ width: 8, height: 8, borderRadius: 3, background: col.color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".04em", color: C.text }}>{col.label}</span>
              <span className="wc-mono" style={{ marginLeft: "auto", fontSize: 10.5, color: C.mute }}>{col.teams.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {col.teams.length === 0 ? (
                <div style={{ fontSize: 11.5, color: C.mute, fontWeight: 600, padding: "8px 4px", opacity: .7 }}>—</div>
              ) : col.teams.map((t) => {
                const champ = col.key === "champion";
                return (
                  <div key={t} className="wc-glass" style={{
                    display: "flex", alignItems: "center", gap: 7, padding: champ ? "10px 10px" : "8px 9px",
                    background: champ ? "rgba(232,184,75,.16)" : C.panel,
                    border: `1px solid ${champ ? C.gold : C.line}`, borderRadius: 11,
                    boxShadow: champ ? "0 8px 22px rgba(232,184,75,.18)" : "none",
                  }}>
                    {champ && <Crown size={15} color={C.gold} style={{ flexShrink: 0 }} />}
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{FLAG[t] || "🏳️"}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t}</span>
                    {RANK[t] && <span className="wc-mono" style={{ fontSize: 9.5, fontWeight: 700, color: C.mute, opacity: .5, marginLeft: "auto", flexShrink: 0 }}>#{RANK[t]}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 11, color: C.mute, marginTop: 10, fontWeight: 600 }}>
        {mode === "actual"
          ? "Live bracket from official results — each column shows who reached that round."
          : "Your predicted run — who you tapped to advance through each round."}
      </p>
    </div>
  );
}

/* --------------------------- MAIN APP --------------------------- */
export default function App() {
  const [view, setView] = useState("predict");
  const [name, setName] = useState("");
  const [committed, setCommitted] = useState(false);
  const [identity, setIdentity] = useState(null); // { name, slug:uid, token:uid, uid, email, groupCode, groupName }
  const [nameError, setNameError] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [howOpen, setHowOpen] = useState(() => { try { return localStorage.getItem("wc26:howOpen") === "1"; } catch { return false; } });
  const toggleHow = () => setHowOpen((o) => { const n = !o; try { localStorage.setItem("wc26:howOpen", n ? "1" : "0"); } catch {} return n; });
  const [session, setSession] = useState(null);   // Supabase auth session (or null)
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState("signin"); // "signin" | "signup"
  const [recovery, setRecovery] = useState(false); // password-reset (PASSWORD_RECOVERY) flow
  const [moversSnap, setMoversSnap] = useState(null); // daily standings baseline for "movers"
  const [moversLoaded, setMoversLoaded] = useState(false);
  const [today, setToday] = useState(null); // { date, matches:[...] } from sync
  const [bracket, setBracket] = useState(null); // shared: { seeds:[[a,b]x16], locked }
  const [koBracket, setKoBracket] = useState({}); // this user's bracket picks { "r_m": team }
  const [newPw, setNewPw] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPw, setAuthPw] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authNotice, setAuthNotice] = useState("");
  const [picks, setPicks] = useState(freshPicks);
  const [results, setResults] = useState(null);    // { A: {order, final}, ... }
  const [resultsDraft, setResultsDraft] = useState(() =>
    Object.fromEntries(GROUP_KEYS.map((k) => [k, { order: [...GROUPS[k]], final: false, played: 0 }])));
  const [allPreds, setAllPreds] = useState([]);
  const [toast, setToast] = useState(null);
  const [showScoring, setShowScoring] = useState(false);
  const isAdmin = !!session?.user?.email && ADMIN_EMAILS.includes(session.user.email.toLowerCase());
  const [phase, setPhase] = useState("group"); // "group" | "knockout"
  const [koPicks, setKoPicks] = useState(emptyKo); // this user's knockout picks
  const [knockout, setKnockout] = useState(null);  // shared: { open, thirds, actual, finals }
  const [koDraft, setKoDraft] = useState({ open: false, thirds: [], actual: emptyKo(), finals: {} });
  const [scope, setScope] = useState("global"); // leaderboard scope: "league" | "global"
  const [boardView, setBoardView] = useState("overall"); // standings metric: "overall" | "bracket"
  const [boardMode, setBoardMode] = useState("projected"); // "projected" | "official"
  const [picksLocked, setPicksLocked] = useState(false); // host-controlled group-pick lock
  const [peopleMode, setPeopleMode] = useState("player"); // everyone's-picks browser: "player" | "group"
  const [openPerson, setOpenPerson] = useState(null);
  const [peopleGroup, setPeopleGroup] = useState(GROUP_KEYS[0]);
  const [leagueMode, setLeagueMode] = useState("none"); // "none" | "create" | "join"
  const [leagueNameInput, setLeagueNameInput] = useState("");
  const [leagueCodeInput, setLeagueCodeInput] = useState("");
  const [leagueError, setLeagueError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [lastSync, setLastSync] = useState(null);
  const didAutoSync = useRef(false);

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2200); };

  const loadAll = useCallback(async () => {
    const list = await store.list(PRED_PREFIX);
    const preds = [];
    for (const k of list.keys) {
      const r = await store.get(k);
      if (r?.value) { try { preds.push(JSON.parse(r.value)); } catch {} }
    }
    preds.sort((a, b) => (a.submittedAt || 0) - (b.submittedAt || 0));
    setAllPreds(preds);
    const rr = await store.get(RESULTS_KEY);
    if (rr?.value) {
      try {
        const parsed = JSON.parse(rr.value);
        setResults(parsed);
        setResultsDraft((d) => ({ ...d, ...parsed }));
      } catch {}
    }
    const kk = await store.get(KNOCKOUT_KEY);
    if (kk?.value) {
      try {
        const parsed = JSON.parse(kk.value);
        const norm = {
          open: !!parsed.open,
          thirds: parsed.thirds || [],
          actual: { ...emptyKo(), ...(parsed.actual || {}) },
          finals: parsed.finals || {},
        };
        setKnockout(norm);
        setKoDraft(norm);
      } catch {}
    }
    const lk = await store.get(LOCK_KEY);
    setPicksLocked(lk?.value === "1" || lk?.value === "true");
    const mv = await store.get(MOVERS_KEY);
    if (mv?.value) { try { setMoversSnap(JSON.parse(mv.value)); } catch {} }
    setMoversLoaded(true);
    const td = await store.get(TODAY_KEY);
    if (td?.value) { try { setToday(JSON.parse(td.value)); } catch {} }
    const bk = await store.get(BRACKET_KEY);
    if (bk?.value) { try { setBracket(JSON.parse(bk.value)); } catch {} } else { setBracket(null); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Load this account's profile (display name + league) and saved picks
  const loadProfile = useCallback(async (user) => {
    if (!user) return;
    const uid = user.id;
    let prof = null;
    if (supabase) {
      const { data } = await supabase.from("profiles").select("name, group_code").eq("id", uid).maybeSingle();
      prof = data || null;
    }
    let groupName = null;
    if (prof?.group_code && supabase) {
      const gr = await store.get(GROUP_PREFIX + prof.group_code);
      if (gr?.value) { try { groupName = JSON.parse(gr.value).name; } catch {} }
    }
    const id = {
      name: prof?.name || "", slug: uid, token: uid, uid, email: user.email,
      groupCode: prof?.group_code || null, groupName,
    };
    setIdentity(id);
    setName(id.name);
    setCommitted(!!id.name);
    // load saved picks for this account
    const pr = await store.get(PRED_PREFIX + uid);
    if (pr?.value) {
      try {
        const rec = JSON.parse(pr.value);
        if (rec.groups) setPicks(rec.groups);
        if (rec.ko) setKoPicks(normalizeKo(rec.ko));
        if (rec.koBracket) setKoBracket(rec.koBracket);
      } catch {}
    }
  }, []);

  // Auth: track the session and react to sign-in / sign-out
  useEffect(() => {
    if (!supabase) { setAuthReady(true); return; }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session || null);
      if (data.session?.user) { loadProfile(data.session.user); loadAll(); }
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => {
      if (_e === "PASSWORD_RECOVERY") setRecovery(true);
      setSession(sess || null);
      if (sess?.user) { loadProfile(sess.user); loadAll(); }
      else { setIdentity(null); setCommitted(false); setName(""); setPicks(freshPicks()); setKoPicks(emptyKo()); setKoBracket({}); }
    });
    return () => sub?.subscription?.unsubscribe?.();
  }, [loadProfile, loadAll]);

  const signIn = async () => {
    if (!supabase) return;
    setAuthBusy(true); setAuthError(""); setAuthNotice("");
    const { error } = await supabase.auth.signInWithPassword({ email: authEmail.trim(), password: authPw });
    if (error) setAuthError(error.message);
    setAuthBusy(false);
  };
  const signUp = async () => {
    if (!supabase) return;
    setAuthBusy(true); setAuthError(""); setAuthNotice("");
    const { data, error } = await supabase.auth.signUp({ email: authEmail.trim(), password: authPw });
    if (error) setAuthError(error.message);
    else if (!data.session) setAuthNotice("Check your email to confirm your account, then sign in.");
    setAuthBusy(false);
  };
  const forgotPw = async () => {
    if (!supabase) return;
    const em = authEmail.trim();
    if (!em) { setAuthError("Enter your email above first, then tap Forgot password."); return; }
    setAuthBusy(true); setAuthError(""); setAuthNotice("");
    const { error } = await supabase.auth.resetPasswordForEmail(em, { redirectTo: window.location.origin });
    if (error) setAuthError(error.message);
    else setAuthNotice("If that email has an account, a reset link is on its way. Open it on this device to set a new password.");
    setAuthBusy(false);
  };
  const submitNewPw = async () => {
    if (!supabase) return;
    if (newPw.length < 6) { setAuthError("Password must be at least 6 characters."); return; }
    setAuthBusy(true); setAuthError("");
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setAuthBusy(false);
    if (error) { setAuthError(error.message); return; }
    setRecovery(false); setNewPw(""); setAuthNotice("Password updated — you're all set.");
  };
  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    setIdentity(null); setCommitted(false); setName(""); setPicks(freshPicks()); setKoPicks(emptyKo()); setPhase("group"); setScope("global");
  };

  useEffect(() => {
    if (view === "results" && isAdmin && !didAutoSync.current) {
      didAutoSync.current = true;
      autoSync();
    }
  }, [view, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  const reorderGroup = (gk, next) => setPicks((p) => ({ ...p, [gk]: next }));
  const reorderResult = (gk, next) => setResultsDraft((p) => ({ ...p, [gk]: { ...p[gk], order: next } }));

  const commitName = async (override) => {
    const nm = (override ?? name).trim();
    if (!nm || !identity?.uid) return false;
    setNameError("");
    if (supabase) {
      // name must be globally unique (case-insensitive), unless it's already mine
      const { data: taken } = await supabase
        .from("profiles").select("id").eq("name_lower", nm.toLowerCase()).neq("id", identity.uid).maybeSingle();
      if (taken) { setNameError(`"${nm}" is already taken — choose a different name.`); return false; }
      const { error } = await supabase.from("profiles").upsert(
        { id: identity.uid, name: nm, name_lower: nm.toLowerCase(), group_code: identity.groupCode || null },
        { onConflict: "id" }
      );
      if (error) { setNameError(error.message.includes("duplicate") ? `"${nm}" is already taken — choose a different name.` : error.message); return false; }
    }
    const wasCommitted = committed;
    const id = { ...identity, name: nm };
    setIdentity(id);
    setName(nm);
    setCommitted(true);
    // tag any existing prediction with the (possibly updated) name — keeps points & picks
    const pr = await store.get(PRED_PREFIX + identity.uid);
    if (pr?.value) {
      try { const rec = JSON.parse(pr.value); rec.name = nm; await store.set(PRED_PREFIX + identity.uid, JSON.stringify(rec)); } catch {}
    }
    await loadAll();
    flash(wasCommitted ? "Name updated — your points & picks stay 🎯" : "Name locked in 🔒");
    return true;
  };

  const submit = async () => {
    if (!identity) return;
    if (picksLocked) { flash("Group picks are locked by the host 🔒"); return; }
    const s = identity.slug;
    // Race guard: don't clobber someone else who claimed this name first
    const existing = await store.get(PRED_PREFIX + s);
    if (existing?.value) {
      try {
        const rec = JSON.parse(existing.value);
        if (rec.ownerToken && rec.ownerToken !== identity.token) {
          setCommitted(false);
          setNameError(`"${identity.name}" was just taken by someone else — pick another name.`);
          setView("predict");
          return;
        }
      } catch {}
    }
    const payload = { slug: s, name: identity.name, groups: picks, ko: normalizeKo(koPicks), groupCode: identity.groupCode || null, ownerToken: identity.token, submittedAt: Date.now() };
    await store.set(PRED_PREFIX + s, JSON.stringify(payload));
    await loadAll();
    flash(phase === "knockout" ? "Knockout picks saved! 🏆" : "Predictions saved! 🎯");
  };

  const saveResults = async () => {
    await store.set(RESULTS_KEY, JSON.stringify(resultsDraft));
    setResults(resultsDraft);
    await loadAll();
    flash("Results updated — scores recalculated");
  };

  // toggle a team within a knockout round (cascade-prunes later rounds)
  const toggleKoRound = (setter, roundKey, team) => {
    const r = KO_ROUNDS.find((x) => x.key === roundKey);
    setter((prev) => {
      const cur = prev[roundKey] || [];
      let next;
      if (cur.includes(team)) next = cur.filter((t) => t !== team);
      else if (r.count === 1) next = [team];
      else if (cur.length < r.count) next = [...cur, team];
      else next = cur;
      return normalizeKo({ ...prev, [roundKey]: next });
    });
  };
  const toggleKoPick = (roundKey, team) => toggleKoRound(setKoPicks, roundKey, team);
  const toggleKoActual = (roundKey, team) =>
    setKoDraft((d) => {
      const fake = { ...d.actual };
      const r = KO_ROUNDS.find((x) => x.key === roundKey);
      const cur = fake[roundKey] || [];
      let next;
      if (cur.includes(team)) next = cur.filter((t) => t !== team);
      else if (r.count === 1) next = [team];
      else if (cur.length < r.count) next = [...cur, team];
      else next = cur;
      return { ...d, actual: normalizeKo({ ...fake, [roundKey]: next }) };
    });
  const toggleThird = (team) =>
    setKoDraft((d) => {
      const cur = d.thirds || [];
      if (cur.includes(team)) return { ...d, thirds: cur.filter((t) => t !== team) };
      if (cur.length >= 8) return d;
      return { ...d, thirds: [...cur, team] };
    });
  const toggleKoFinal = (roundKey) =>
    setKoDraft((d) => ({ ...d, finals: { ...d.finals, [roundKey]: !d.finals?.[roundKey] } }));
  const saveKnockout = async () => {
    await store.set(KNOCKOUT_KEY, JSON.stringify(koDraft));
    setKnockout(koDraft);
    await loadAll();
    flash("Knockout updated — scores recalculated");
  };

  // ----- knockout bracket (new) -----
  const handleBracketPick = (r, m, team) => {
    if (bracket?.locked) return;
    setKoBracket((prev) => brSanitize({ ...prev, [`${r}_${m}`]: team }));
  };
  const saveBracket = async () => {
    if (!identity) return;
    if (bracket?.locked) { flash("The bracket is locked by the host 🔒"); return; }
    const s = identity.slug;
    let rec = {};
    const ex = await store.get(PRED_PREFIX + s);
    if (ex?.value) { try { rec = JSON.parse(ex.value); } catch {} }
    rec.slug = s; rec.name = identity.name; rec.ownerToken = identity.token; rec.groupCode = identity.groupCode || null;
    if (!rec.groups) rec.groups = picks;
    if (!rec.ko) rec.ko = normalizeKo(koPicks);
    rec.koBracket = koBracket;
    if (!rec.submittedAt) rec.submittedAt = Date.now();
    await store.set(PRED_PREFIX + s, JSON.stringify(rec));
    await loadAll();
    flash("Bracket saved 🏆");
  };
  // host controls
  const writeBracket = async (next) => { await store.set(BRACKET_KEY, JSON.stringify(next)); setBracket(next); };
  const toggleBracketLock = async () => {
    const next = { seeds: bracket?.seeds || [], locked: !(bracket?.locked) };
    if (next.locked && !window.confirm("Lock the bracket? Players won't be able to change their picks until you unlock.")) return;
    await writeBracket(next);
    flash(next.locked ? "Bracket locked 🔒" : "Bracket unlocked 🔓");
  };
  const clearBracket = async () => {
    if (!window.confirm("Clear the bracket field? Everyone's bracket picks remain saved but the field is removed.")) return;
    await store.del(BRACKET_KEY);
    setBracket(null);
    flash("Bracket field cleared");
  };
  const loadSampleTest = async () => {
    if (!window.confirm("Load a SAMPLE 32-team field WITH fake results, so you can see bracket scoring on the Board? Fill your bracket afterward to see points.")) return;
    await writeBracket({ seeds: SAMPLE_BRACKET, locked: false, results: sampleResults(SAMPLE_BRACKET) });
    flash("Sample field + results loaded — fill your bracket, then check the Board");
  };

  // Auto-fill results from the live web via the built-in AI + web search
  const autoSync = async () => {
    if (syncing) return;
    setSyncing(true); setSyncMsg("");
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const j = await res.json();
      if (!j || j.ok === false) throw new Error((j && j.error) || "sync-failed");
      await loadAll();
      setLastSync(Date.now());
      const groupsSet = j.groupsSet || 0, koRounds = j.koRounds || 0;
      setSyncMsg(groupsSet === 0 && koRounds === 0
        ? "No completed matches found yet — nothing to update."
        : `Synced ${groupsSet}/12 groups${koRounds ? ` and ${koRounds} knockout round${koRounds > 1 ? "s" : ""}` : ""}. Scores updated.`);
    } catch (e) {
      setSyncMsg("Couldn't fetch live results just now. Try again, or enter results manually below.");
    } finally {
      setSyncing(false);
    }
  };

  // ---- private leagues ----
  const persistIdentity = async (id) => {
    setIdentity(id);
    if (supabase && id?.uid) {
      await supabase.from("profiles").upsert(
        { id: id.uid, name: id.name, name_lower: (id.name || "").toLowerCase(), group_code: id.groupCode || null },
        { onConflict: "id" }
      );
    }
  };
  // keep this device's submitted prediction tagged with the current league
  const patchMyGroupCode = async (code) => {
    if (!identity) return;
    const r = await store.get(PRED_PREFIX + identity.slug);
    if (r?.value) {
      try {
        const rec = JSON.parse(r.value);
        if (!rec.ownerToken || rec.ownerToken === identity.token) {
          rec.groupCode = code || null;
          await store.set(PRED_PREFIX + identity.slug, JSON.stringify(rec));
        }
      } catch {}
    }
  };
  const createLeague = async () => {
    if (!identity) return;
    setLeagueError("");
    const nm = leagueNameInput.trim() || "Untitled League";
    let code = genCode();
    for (let i = 0; i < 8; i++) {
      const existing = await store.get(GROUP_PREFIX + code);
      if (!existing?.value) break;
      code = genCode();
    }
    await store.set(GROUP_PREFIX + code, JSON.stringify({ code, name: nm, createdAt: Date.now() }));
    await persistIdentity({ ...identity, groupCode: code, groupName: nm });
    await patchMyGroupCode(code);
    setLeagueMode("none"); setLeagueNameInput(""); setScope("league");
    await loadAll();
    flash(`League created · code ${code}`);
  };
  const joinLeague = async () => {
    if (!identity) return;
    const code = leagueCodeInput.trim().toUpperCase();
    if (!code) return;
    const r = await store.get(GROUP_PREFIX + code);
    if (!r?.value) { setLeagueError(`No league found with code "${code}".`); return; }
    let g; try { g = JSON.parse(r.value); } catch { g = { code, name: "League" }; }
    setLeagueError("");
    await persistIdentity({ ...identity, groupCode: code, groupName: g.name });
    await patchMyGroupCode(code);
    setLeagueMode("none"); setLeagueCodeInput(""); setScope("league");
    await loadAll();
    flash(`Joined ${g.name}! 🤝`);
  };
  const leaveLeague = async () => {
    if (!identity) return;
    await persistIdentity({ ...identity, groupCode: null, groupName: null });
    await patchMyGroupCode(null);
    setScope("global");
    await loadAll();
    flash("Left the league");
  };
  const copyCode = async (code) => {
    try { await navigator.clipboard.writeText(code); flash("Code copied — share it!"); }
    catch { flash(`Code: ${code}`); }
  };

  const resetAll = async () => {
    if (!window.confirm("Delete ALL predictions and results for everyone? This cannot be undone.")) return;
    const list = await store.list(PRED_PREFIX);
    for (const k of list.keys) await store.del(k);
    await store.del(RESULTS_KEY);
    await store.del(KNOCKOUT_KEY);
    const groups = await store.list(GROUP_PREFIX);
    for (const k of groups.keys) await store.del(k);
    setResults(null);
    setKnockout(null);
    setKoDraft({ open: false, thirds: [], actual: emptyKo(), finals: {} });
    setResultsDraft(Object.fromEntries(GROUP_KEYS.map((k) => [k, { order: [...GROUPS[k]], final: false, played: 0 }])));
    await loadAll();
    flash("Everything reset");
  };

  const toggleLock = async () => {
    const next = !picksLocked;
    if (next && !window.confirm("Lock all group picks? Players won't be able to change their group order until you unlock.")) return;
    await store.set(LOCK_KEY, next ? "1" : "0");
    setPicksLocked(next);
    flash(next ? "Group picks locked 🔒" : "Group picks unlocked 🔓");
  };

  const shareMyPicks = async () => {
    try {
      const W = 1080, H = 1350;
      const cv = document.createElement("canvas");
      cv.width = W; cv.height = H;
      const ctx = cv.getContext("2d");
      ctx.fillStyle = "#FBFAF7"; ctx.fillRect(0, 0, W, H);
      const grd = ctx.createLinearGradient(0, 0, W, 250);
      grd.addColorStop(0, "#F3D27A"); grd.addColorStop(.55, "#E8B84B"); grd.addColorStop(1, "#C99A3B");
      ctx.fillStyle = grd; ctx.fillRect(0, 0, W, 250);
      ctx.fillStyle = "#201700";
      ctx.font = "800 32px 'Plus Jakarta Sans', sans-serif";
      ctx.fillText("MY WORLD CUP 2026 PICKS", 60, 105);
      ctx.font = "800 64px 'Bricolage Grotesque','Plus Jakarta Sans',sans-serif";
      ctx.fillText((identity?.name || "My picks").slice(0, 18), 60, 185);
      let y = 330;
      const champ = koPicks?.champion?.[0];
      if (champ) {
        ctx.fillStyle = "#1A1712"; ctx.font = "800 32px 'Plus Jakarta Sans',sans-serif";
        ctx.fillText("🏆 Champion: " + (FLAG[champ] || "") + " " + champ, 60, y);
        y += 72;
      }
      ctx.fillStyle = "#6E6A60"; ctx.font = "800 22px 'Plus Jakarta Sans',sans-serif";
      ctx.fillText("PREDICTED GROUP WINNERS", 60, y); y += 54;
      const colX = [60, 580];
      GROUP_KEYS.forEach((g, i) => {
        const x = colX[i < 6 ? 0 : 1];
        const yy = y + (i % 6) * 82;
        const w = picks[g]?.[0];
        ctx.fillStyle = "#C8901C"; ctx.font = "800 24px 'Plus Jakarta Sans',sans-serif";
        ctx.fillText("Group " + g, x, yy);
        ctx.fillStyle = "#1A1712"; ctx.font = "700 30px 'Plus Jakarta Sans',sans-serif";
        ctx.fillText(((FLAG[w] || "") + " " + (w || "—")).slice(0, 22), x, yy + 38);
      });
      ctx.fillStyle = "#6E6A60"; ctx.font = "600 24px 'Plus Jakarta Sans',sans-serif";
      ctx.fillText("World Cup 2026 Predictor", 60, H - 56);
      await new Promise((res) => cv.toBlob(async (blob) => {
        if (!blob) { res(); return; }
        const file = new File([blob], "my-wc-picks.png", { type: "image/png" });
        try {
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: "My World Cup 2026 picks" });
            res(); return;
          }
        } catch {}
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = "my-wc-picks.png";
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        res();
      }, "image/png"));
    } catch {
      flash("Couldn't make the image on this device");
    }
  };

  // ----- leaderboard math -----
  const finalGroups = results ? GROUP_KEYS.filter((k) => results[k]?.final && results[k].order?.length === 4) : [];
  // a group counts as "live" for projections once it's final or has at least
  // one match played (set by the sync, or by the host's "played" control)
  const isLiveGroup = (k) => {
    const r = results?.[k];
    if (!r?.order || r.order.length !== 4) return false;
    return r.final || (r.played || 0) > 0;
  };
  const liveGroups = results ? GROUP_KEYS.filter(isLiveGroup) : [];
  const hasLive = liveGroups.some((k) => !results[k].final); // any provisional (non-final) standings
  const projecting = boardMode === "projected" && hasLive;    // effective mode
  const scoreGroups2 = liveGroups; // groups counted when projecting
  const koActual = knockout?.actual;
  const koFinals = knockout?.finals || {};
  const koScoredRounds = KO_ROUNDS.filter((r) => koFinals?.[r.key]);
  const standings = allPreds.map((p) => {
    let groupPtsOfficial = 0, groupPtsProjected = 0; const per = {}, perProj = {};
    for (const k of liveGroups) {
      const s = scoreGroup(p.groups[k], results[k].order);
      perProj[k] = s.points; groupPtsProjected += s.points;
      if (results[k].final) { per[k] = s.points; groupPtsOfficial += s.points; }
    }
    const ks = scoreKnockout(p.ko, koActual, koFinals);
    const totalOfficial = groupPtsOfficial + ks.points;
    const totalProjected = groupPtsProjected + ks.points;
    const brPts = scoreBracket(p.koBracket, bracket?.results);
    const activeTotal = projecting ? totalProjected : totalOfficial;
    return {
      ...p, koPts: ks.points, koPer: ks.per, per, perProj,
      groupPts: projecting ? groupPtsProjected : groupPtsOfficial,
      total: activeTotal,
      totalOfficial, totalProjected,
      brPts, combined: activeTotal + brPts,
    };
  }).sort((a, b) => b.total - a.total || a.submittedAt - b.submittedAt);

  // ----- daily movers: capture a once-a-day baseline of everyone's projected total -----
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" }); // Pacific YYYY-MM-DD
  useEffect(() => {
    if (!storageReady || !moversLoaded || standings.length === 0) return;
    const anyScored = standings.some((p) => (p.totalProjected || 0) > 0);
    if (!anyScored) return; // never set a baseline before there's any scoring (avoids a meaningless all-zero start)
    if (moversSnap?.baselineDay === todayStr && moversSnap?.v === 3) return; // today's baseline already saved
    const baseline = {};
    standings.forEach((p) => { baseline[p.slug] = p.totalProjected; });
    const snap = { v: 3, baselineDay: todayStr, baseline };
    setMoversSnap(snap);
    store.set(MOVERS_KEY, JSON.stringify(snap));
  }, [storageReady, moversLoaded, standings, moversSnap, todayStr]);

  // league scope
  const myCode = identity?.groupCode || null;
  const inLeague = !!myCode;
  const useLeague = scope === "league" && inLeague;
  const scopedStandings = useLeague ? standings.filter((p) => p.groupCode === myCode) : standings;
  const scopedPreds = useLeague ? allPreds.filter((p) => p.groupCode === myCode) : allPreds;

  // bracket-aware board: "overall" (group + bracket) or "bracket" (bracket only)
  const bracketActive = !!(bracket?.seeds?.length);
  const bv = bracketActive ? boardView : "overall";
  const viewMetric = (p) => (bv === "bracket" ? (p.brPts || 0) : (p.combined != null ? p.combined : p.total));
  const viewStandings = bracketActive
    ? [...scopedStandings].sort((a, b) => viewMetric(b) - viewMetric(a) || (a.submittedAt || 0) - (b.submittedAt || 0))
    : scopedStandings;

  // movers = rank change WITHIN the current view (global or league) vs today's baseline totals
  const moversBase = moversSnap?.v === 3 ? moversSnap.baseline : null;
  let moversList = [];
  if (moversBase) {
    const eligible = scopedStandings.filter((p) => moversBase[p.slug] != null); // already in current order
    const curRank = {}; eligible.forEach((p, i) => { curRank[p.slug] = i + 1; });
    const baseRank = {};
    [...eligible].sort((a, b) => (moversBase[b.slug] - moversBase[a.slug]) || ((a.submittedAt || 0) - (b.submittedAt || 0)))
      .forEach((p, i) => { baseRank[p.slug] = i + 1; });
    moversList = eligible.map((p) => ({ slug: p.slug, name: p.name, delta: baseRank[p.slug] - curRank[p.slug] }))
      .filter((m) => m.delta !== 0);
  }
  const climbers = moversList.filter((m) => m.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 3);
  const fallers = moversList.filter((m) => m.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 3);
  const hasMovers = climbers.length > 0 || fallers.length > 0;

  // pool of 32 qualifiers (uses saved third-place selection)
  const koPool = poolOf32(results, knockout?.thirds);
  const koPoolDraft = poolOf32(results, koDraft.thirds);
  const allGroupsFinal = finalGroups.length === 12;
  const thirdTeams = allGroupsFinal ? GROUP_KEYS.map((k) => results[k].order[2]) : [];

  // ----- tournament tracker: remaining teams & matches -----
  const kf = koFinals;
  const teamsLeft = kf.champion ? 1 : kf.final ? 2 : kf.sf ? 4 : kf.qf ? 8 : kf.r16 ? 16 : allGroupsFinal ? 32 : 48;
  const groupMatchesPlayed = results ? GROUP_KEYS.reduce((n, k) => {
    const r = results[k];
    if (!r) return n;
    return n + (r.final ? 6 : Math.min(6, r.played || 0));
  }, 0) : 0;
  const matchesPlayed =
    groupMatchesPlayed +                            // actual group matches played so far
    (kf.r16 ? 16 : 0) + (kf.qf ? 8 : 0) + (kf.sf ? 4 : 0) +
    (kf.final ? 2 : 0) + (kf.champion ? 2 : 0);     // champion done ⇒ final + 3rd-place played
  const matchesLeft = 104 - matchesPlayed;
  const stageLabel = kf.champion ? "Champion crowned 🏆" : kf.final ? "The Final" : kf.sf ? "Semi-finals"
    : kf.qf ? "Quarter-finals" : kf.r16 ? "Round of 16" : allGroupsFinal ? "Round of 32"
    : (groupMatchesPlayed > 0 || finalGroups.length > 0) ? "Group stage" : "Kicks off June 11";
  const survivors = kf.champion ? (koActual?.champion || [])
    : kf.final ? (koActual?.final || []) : kf.sf ? (koActual?.sf || [])
    : kf.qf ? (koActual?.qf || []) : kf.r16 ? (koActual?.r16 || [])
    : (allGroupsFinal && koPool.length === 32 ? koPool : null);

  // current user's live group breakdown (projection)
  const myGroupsForProj = (identity && allPreds.find((p) => p.slug === identity.slug)?.groups) || picks;
  const liveBreakdown = liveGroups.map((k) => {
    const order = results[k].order;
    const s = scoreGroup(myGroupsForProj[k], order);
    return { gk: k, order, pts: s.points, played: results[k].played, total: results[k].total || 6, final: results[k].final };
  });

  // consensus winners (pre-results)
  const consensus = GROUP_KEYS.map((k) => {
    const tally = {};
    scopedPreds.forEach((p) => { const w = p.groups[k]?.[0]; if (w) tally[w] = (tally[w] || 0) + 1; });
    const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
    return { gk: k, team: top?.[0], votes: top?.[1] || 0 };
  });

  return (
    <div className="wc-root wc-aurora" style={{ minHeight: "100vh", color: C.text, paddingBottom: 90 }}>
      <Styles />

      {/* Header / Hero */}
      <header style={{ padding: "20px 16px 20px", borderBottom: `1px solid ${C.line}`, position: "relative", overflow: "hidden" }}>
        {/* decorative flag marquee */}
        <div style={{ position: "absolute", top: 8, left: 0, right: 0, opacity: .1, pointerEvents: "none", overflow: "hidden", WebkitMaskImage: "linear-gradient(90deg, transparent, #000 15%, #000 85%, transparent)", maskImage: "linear-gradient(90deg, transparent, #000 15%, #000 85%, transparent)" }}>
          <div className="wc-marquee" style={{ fontSize: 24 }}>
            {[...Object.values(FLAG), ...Object.values(FLAG)].map((f, i) => <span key={i}>{f}</span>)}
          </div>
        </div>

        <div style={{ position: "relative" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 800, letterSpacing: ".2em", color: C.green, marginBottom: 10, marginTop: 14, padding: "5px 11px", borderRadius: 999, border: `1px solid ${C.line}`, background: "rgba(232,184,75,.07)" }}>
            FIFA WORLD CUP 2026 · 🇺🇸 🇨🇦 🇲🇽
          </div>
          <h1 className="wc-display wc-glow" style={{ fontSize: "clamp(36px,11vw,58px)", lineHeight: .88, margin: 0 }}>
            World Cup<br /><span className="wc-grad-text wc-shine">Predictor</span>
          </h1>
          <p style={{ color: C.text, fontSize: 15, marginTop: 12, maxWidth: 560, lineHeight: 1.5, fontWeight: 600 }}>
            The ultimate <span style={{ color: C.green }}>bragging-rights showdown</span> for you and your crew. Spin up a <span style={{ color: C.blue }}>private league</span>, call all 48 teams, conquer the bracket, and climb both your league and the <span style={{ color: C.blue }}>global leaderboard</span>. 🏆
          </p>

          {/* stat strip */}
          <div className="wc-glass" style={{ display: "flex", gap: 4, marginTop: 16, padding: 4, background: C.soft, border: `1px solid ${C.line}`, borderRadius: 14 }}>
            {[["48", "TEAMS"], ["12", "GROUPS"], ["104", "MATCHES"], [`${204 + KO_MAX}`, "MAX PTS"]].map(([n, l], i) => (
              <div key={l} style={{ flex: 1, textAlign: "center", padding: "8px 2px", borderLeft: i ? `1px solid ${C.line}` : "none" }}>
                <div className="wc-mono" style={{ fontSize: 19, fontWeight: 700, color: C.text, lineHeight: 1 }}>{n}</div>
                <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: ".1em", color: C.mute, marginTop: 4 }}>{l}</div>
              </div>
            ))}
          </div>

          <TodayMatches data={today} />

          {/* how it works (collapsible) */}
          <button className="wc-btn" onClick={toggleHow} style={{
            display: "flex", alignItems: "center", gap: 8, width: "100%", background: "transparent",
            border: "none", cursor: "pointer", padding: "4px 0", color: C.mute, margin: "20px 0 0",
          }}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".18em" }}>HOW IT WORKS</span>
            <span style={{ flex: 1, height: 1, background: C.line }} />
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 700, color: C.gold }}>
              {howOpen ? <>Hide <ChevronUp size={15} /></> : <>Show <ChevronDown size={15} /></>}
            </span>
          </button>
          <div style={{ overflow: "hidden", transition: "max-height .38s cubic-bezier(.2,.8,.2,1), opacity .3s", maxHeight: howOpen ? 700 : 0, opacity: howOpen ? 1 : 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
            {[
              { n: 1, icon: Flag, color: "#E8B84B", t: "Claim Your Name", d: "Lock in a one-of-a-kind handle. No duplicates, no impostors — your picks stay yours." },
              { n: 2, icon: GripVertical, color: "#6FB1EC", t: "Rank the Groups", d: "Drag teams into your predicted finishing order. Nail the table for max points." },
              { n: 3, icon: Trophy, color: "#5FC076", t: "Conquer the Bracket", d: "Round of 16 to the Final — call who survives all the way to champion." },
              { n: 4, icon: Crown, color: "#EE7E76", t: "Leagues & Glory", d: "Battle a private league via join code, plus the global board. One champion of the pool." },
            ].map((c) => (
              <div key={c.n} className="wc-hero-card wc-glass" style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 13 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, display: "grid", placeItems: "center", background: `${c.color}1f`, border: `1px solid ${c.color}55`, flexShrink: 0 }}>
                    <c.icon size={16} color={c.color} />
                  </div>
                  <span className="wc-mono" style={{ fontSize: 12, fontWeight: 700, color: c.color }}>0{c.n}</span>
                </div>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 3 }}>{c.t}</div>
                <div style={{ fontSize: 11.5, color: C.mute, lineHeight: 1.45 }}>{c.d}</div>
              </div>
            ))}
          </div>
          </div>

          {/* two-round note + CTAs */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, padding: "10px 13px", borderRadius: 12, background: "rgba(232,184,75,.06)", border: `1px solid ${C.line}` }}>
            <Trophy size={16} color={C.gold} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, color: C.mute, fontWeight: 600 }}>
              <b style={{ color: C.text }}>Two rounds, one champion:</b> group-stage points carry straight into the knockout — every pick counts to the final whistle.
            </span>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <button className="wc-btn" onClick={() => setView("predict")} style={{
              display: "inline-flex", alignItems: "center", gap: 7, background: C.grad, color: "#201700",
              border: "none", borderRadius: 999, padding: "11px 18px", fontSize: 14, fontWeight: 800,
              cursor: "pointer", boxShadow: GRAD_SHADOW,
            }}><Flag size={15} /> Start predicting</button>
            <button className="wc-btn" onClick={() => setShowScoring(true)} style={{
              display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(232,184,75,.07)",
              color: C.gold, border: `1px solid ${C.line}`, borderRadius: 999, padding: "11px 16px",
              fontSize: 13.5, fontWeight: 700, cursor: "pointer",
            }}><Info size={14} /> How scoring works</button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      {session && !recovery && (
      <nav className="wc-glass" style={{ display: "flex", gap: 5, padding: "8px 10px", position: "sticky", top: 0, zIndex: 20, background: C.navbg, borderBottom: `1px solid ${C.line}` }}>
        {[["predict", "Group Stage", Flag], ["bracket", "Knockout Stage", GitBranch], ["board", "Board", Trophy], ...(isAdmin ? [["results", "Results", ShieldCheck]] : [])].map(([id, label, Icon]) => {
          const TabIcon = (id === "bracket" && !knockout?.open) ? Lock : Icon;
          return (
          <button key={id} className="wc-tab wc-btn" onClick={() => setView(id)} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
            padding: "11px 3px", borderRadius: 14, border: "none", cursor: "pointer",
            fontWeight: 800, fontSize: 11, whiteSpace: "nowrap",
            background: view === id ? C.grad : C.soft,
            color: view === id ? "#201700" : C.mute,
            boxShadow: view === id ? GRAD_SHADOW : "none",
          }}><TabIcon size={13} style={{ flexShrink: 0 }} /> {label}</button>
          );
        })}
      </nav>
      )}

      <main style={{ maxWidth: 620, margin: "0 auto", padding: "16px 12px" }}>
        {!authReady ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: C.mute }}>
            <RefreshCw size={26} className="wc-spin" style={{ margin: "0 auto" }} />
            <p style={{ marginTop: 12, fontWeight: 600, fontSize: 14 }}>Loading…</p>
          </div>
        ) : recovery ? (
          <div className="wc-fade wc-glass" style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 22, padding: 22, maxWidth: 420, margin: "8px auto", boxShadow: "0 10px 30px rgba(20,20,25,.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: C.grad, display: "grid", placeItems: "center", boxShadow: GRAD_SHADOW }}>
                <Lock size={20} color="#201700" />
              </div>
              <div>
                <div className="wc-display" style={{ fontSize: 22, lineHeight: 1 }}>Set a new password</div>
                <div style={{ fontSize: 12, color: C.mute, fontWeight: 600 }}>Choose a new password for your account</div>
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".12em", color: C.mute, display: "flex", alignItems: "center", gap: 6 }}><Lock size={13} /> NEW PASSWORD</label>
              <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="••••••••"
                onKeyDown={(e) => e.key === "Enter" && submitNewPw()}
                style={{ width: "100%", marginTop: 6, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px", color: C.text, fontSize: 15, fontWeight: 600 }} />
            </div>
            {authError && <p style={{ fontSize: 12, color: C.coral, fontWeight: 700, margin: "10px 0 0" }}>{authError}</p>}
            <button className="wc-btn" onClick={submitNewPw} disabled={authBusy || newPw.length < 6} style={{
              width: "100%", marginTop: 16, background: C.grad, color: "#201700", border: "none", borderRadius: 12,
              padding: "14px", fontWeight: 800, fontSize: 15, cursor: authBusy ? "default" : "pointer", boxShadow: GRAD_SHADOW,
              opacity: authBusy || newPw.length < 6 ? .6 : 1,
            }}>{authBusy ? "…" : "Update password"}</button>
          </div>
        ) : !session ? (
          <AuthGate
            mode={authMode} setMode={setAuthMode}
            email={authEmail} setEmail={setAuthEmail}
            pw={authPw} setPw={setAuthPw}
            error={authError} notice={authNotice} busy={authBusy}
            onSignIn={signIn} onSignUp={signUp} onForgot={forgotPw} ready={!!supabase}
          />
        ) : (
        <>
        {/* ---------------- PREDICT ---------------- */}
        {view === "predict" && (
          <div>
            {committed && identity ? (
              <div className="wc-glass" style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, padding: 16, marginBottom: 16, boxShadow: "0 8px 24px rgba(20,20,25,.08)" }}>
                {!editingName ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: C.grad, display: "grid", placeItems: "center", color: "#201700", fontWeight: 800, fontSize: 18, flexShrink: 0 }}>
                      {identity.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".12em", color: C.mute }}>PLAYING AS</div>
                      <div style={{ fontSize: 17, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{identity.name}</div>
                      {identity.email && <div style={{ fontSize: 10.5, color: C.mute, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{identity.email}</div>}
                    </div>
                    <button className="wc-btn" onClick={() => { setNameDraft(identity.name); setNameError(""); setEditingName(true); }} style={{
                      display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(232,184,75,.1)", color: C.gold, border: `1px solid ${C.gold}`, borderRadius: 10,
                      padding: "8px 11px", fontWeight: 700, fontSize: 12.5, cursor: "pointer", flexShrink: 0,
                    }}><Pencil size={13} /> Change name</button>
                    <button className="wc-btn" onClick={signOut} style={{
                      display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", color: C.mute, border: `1px solid ${C.line}`, borderRadius: 10,
                      padding: "8px 11px", fontWeight: 700, fontSize: 12.5, cursor: "pointer", flexShrink: 0,
                    }}><LogOut size={14} /></button>
                  </div>
                ) : (
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".12em", color: C.mute }}>NEW DISPLAY NAME</label>
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <input value={nameDraft} autoFocus maxLength={24}
                        onChange={(e) => { setNameDraft(e.target.value); setNameError(""); }}
                        onKeyDown={async (e) => { if (e.key === "Enter") { const ok = await commitName(nameDraft); if (ok) setEditingName(false); } }}
                        style={{ flex: 1, background: C.panel2, border: `1px solid ${nameError ? C.coral : C.line}`, borderRadius: 12, padding: "11px 12px", color: C.text, fontSize: 15, fontWeight: 600 }} />
                      <button className="wc-btn" onClick={async () => { const ok = await commitName(nameDraft); if (ok) setEditingName(false); }} style={{
                        background: C.grad, color: "#201700", border: "none", borderRadius: 12, padding: "0 16px", fontWeight: 800, fontSize: 14, cursor: "pointer", boxShadow: GRAD_SHADOW, display: "inline-flex", alignItems: "center", gap: 5,
                      }}><Check size={16} /> Save</button>
                      <button className="wc-btn" onClick={() => { setEditingName(false); setNameError(""); }} style={{
                        background: "transparent", color: C.mute, border: `1px solid ${C.line}`, borderRadius: 12, padding: "0 12px", fontWeight: 700, fontSize: 13, cursor: "pointer",
                      }}><X size={16} /></button>
                    </div>
                    {nameError ? (
                      <p style={{ fontSize: 12, color: C.coral, fontWeight: 700, margin: "8px 0 0" }}>{nameError}</p>
                    ) : (
                      <p style={{ fontSize: 11.5, color: C.mute, margin: "8px 0 0" }}>Names are globally unique. Your points and picks stay with you.</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="wc-glass" style={{ background: C.panel, border: `1px solid ${nameError ? C.coral : C.line}`, borderRadius: 18, padding: 16, marginBottom: 16, boxShadow: "0 8px 24px rgba(20,20,25,.08)" }}>
                <label style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".12em", color: C.mute }}>CHOOSE A UNIQUE NAME</label>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <input value={name} onChange={(e) => { setName(e.target.value); setNameError(""); }}
                    placeholder="e.g. Nolan"
                    onKeyDown={(e) => e.key === "Enter" && commitName()}
                    style={{
                      flex: 1, background: C.panel2, border: `1px solid ${nameError ? C.coral : C.line}`, borderRadius: 12,
                      padding: "11px 12px", color: C.text, fontSize: 15, fontWeight: 600,
                    }} />
                  <button className="wc-btn" onClick={() => commitName()} disabled={!name.trim()} style={{
                    background: name.trim() ? C.grad : C.panel2, color: name.trim() ? "#201700" : C.mute,
                    border: "none", borderRadius: 12, padding: "0 18px", fontWeight: 800, fontSize: 14,
                    cursor: name.trim() ? "pointer" : "default",
                    boxShadow: name.trim() ? GRAD_SHADOW : "none",
                  }}>Go</button>
                </div>
                {nameError ? (
                  <p style={{ fontSize: 12, color: C.coral, marginTop: 8, marginBottom: 0, fontWeight: 700 }}>{nameError}</p>
                ) : (
                  <p style={{ fontSize: 11.5, color: C.mute, marginTop: 8, marginBottom: 0 }}>
                    Names are globally unique and tied to your account, so you can sign in and edit your picks from any device.
                  </p>
                )}
              </div>
            )}

            {committed && identity && (
              <div className="wc-glass" style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, padding: 16, marginBottom: 16, boxShadow: "0 8px 24px rgba(20,20,25,.08)" }}>
                {identity.groupCode ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(91,200,255,.14)", border: `1px solid rgba(91,200,255,.4)`, display: "grid", placeItems: "center", flexShrink: 0 }}>
                      <Users size={20} color={C.blue} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".12em", color: C.mute }}>YOUR LEAGUE</div>
                      <div style={{ fontSize: 16, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{identity.groupName || "League"}</div>
                    </div>
                    <button className="wc-btn" onClick={() => copyCode(identity.groupCode)} style={{
                      display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(91,200,255,.1)", border: `1px solid rgba(91,200,255,.4)`,
                      borderRadius: 10, padding: "8px 12px", cursor: "pointer", flexShrink: 0,
                    }}>
                      <span className="wc-mono" style={{ fontSize: 16, fontWeight: 700, letterSpacing: ".18em", color: C.blue }}>{identity.groupCode}</span>
                      <Copy size={14} color={C.blue} />
                    </button>
                    <button className="wc-btn" onClick={leaveLeague} style={{
                      background: "transparent", color: C.mute, border: `1px solid ${C.line}`, borderRadius: 10,
                      padding: "8px 12px", fontWeight: 700, fontSize: 12.5, cursor: "pointer", flexShrink: 0,
                    }}>Leave</button>
                    <p style={{ width: "100%", fontSize: 11.5, color: C.mute, margin: "2px 0 0" }}>
                      Share this code so friends can join. You're also ranked on the global board.
                    </p>
                  </div>
                ) : leagueMode === "none" ? (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Users size={16} color={C.blue} />
                      <span style={{ fontWeight: 800, fontSize: 14 }}>Play in a private league</span>
                    </div>
                    <p style={{ fontSize: 12, color: C.mute, margin: "6px 0 12px" }}>
                      Compete head-to-head with just your crew — or skip it and battle the whole world. You'll be on the global board either way.
                    </p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="wc-btn" onClick={() => { setLeagueMode("create"); setLeagueError(""); }} style={{
                        flex: 1, background: C.grad, color: "#201700", border: "none", borderRadius: 12, padding: "11px",
                        fontWeight: 800, fontSize: 13.5, cursor: "pointer", boxShadow: GRAD_SHADOW,
                      }}>Create a league</button>
                      <button className="wc-btn" onClick={() => { setLeagueMode("join"); setLeagueError(""); }} style={{
                        flex: 1, background: "transparent", color: C.text, border: `1px solid ${C.line}`, borderRadius: 12, padding: "11px",
                        fontWeight: 800, fontSize: 13.5, cursor: "pointer",
                      }}>Join with code</button>
                    </div>
                  </div>
                ) : leagueMode === "create" ? (
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".12em", color: C.mute }}>NAME YOUR LEAGUE</label>
                    <input value={leagueNameInput} onChange={(e) => setLeagueNameInput(e.target.value)}
                      placeholder="e.g. The Office Cup" onKeyDown={(e) => e.key === "Enter" && createLeague()}
                      style={{ width: "100%", marginTop: 8, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 12, padding: "11px 12px", color: C.text, fontSize: 15, fontWeight: 600 }} />
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button className="wc-btn" onClick={createLeague} style={{ flex: 1, background: C.grad, color: "#201700", border: "none", borderRadius: 12, padding: "11px", fontWeight: 800, fontSize: 13.5, cursor: "pointer", boxShadow: GRAD_SHADOW }}>Create & get code</button>
                      <button className="wc-btn" onClick={() => setLeagueMode("none")} style={{ background: "transparent", color: C.mute, border: `1px solid ${C.line}`, borderRadius: 12, padding: "11px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".12em", color: C.mute }}>ENTER LEAGUE CODE</label>
                    <input value={leagueCodeInput} onChange={(e) => { setLeagueCodeInput(e.target.value.toUpperCase()); setLeagueError(""); }}
                      placeholder="e.g. K7P3M" maxLength={6} onKeyDown={(e) => e.key === "Enter" && joinLeague()}
                      style={{ width: "100%", marginTop: 8, background: C.panel2, border: `1px solid ${leagueError ? C.coral : C.line}`, borderRadius: 12, padding: "11px 12px", color: C.text, fontSize: 17, fontWeight: 700, letterSpacing: ".22em", fontFamily: "'Space Mono', monospace" }} />
                    {leagueError && <p style={{ fontSize: 12, color: C.coral, margin: "8px 0 0", fontWeight: 700 }}>{leagueError}</p>}
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button className="wc-btn" onClick={joinLeague} style={{ flex: 1, background: C.grad, color: "#201700", border: "none", borderRadius: 12, padding: "11px", fontWeight: 800, fontSize: 13.5, cursor: "pointer", boxShadow: GRAD_SHADOW }}>Join league</button>
                      <button className="wc-btn" onClick={() => setLeagueMode("none")} style={{ background: "transparent", color: C.mute, border: `1px solid ${C.line}`, borderRadius: 12, padding: "11px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {committed && (
              <div style={{ display: "flex", alignItems: "center", gap: 7, color: C.mute, fontSize: 12.5, fontWeight: 600, marginBottom: 12 }}>
                <GripVertical size={15} style={{ color: C.green }} />
                Drag the handle on the right of each team to its predicted finishing position.
              </div>
            )}
            {picksLocked && (
              <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "14px 16px", borderRadius: 16, marginBottom: 14, background: "rgba(62,158,94,.09)", border: `1px solid ${C.green}` }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: "rgba(62,158,94,.16)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <Check size={20} color={C.green} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, display: "flex", alignItems: "center", gap: 7 }}>
                    Submitted <Lock size={13} color={C.mute} /> <span style={{ color: C.mute, fontWeight: 700, fontSize: 13 }}>· locked</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: C.mute, fontWeight: 600 }}>This is your final group order. See everyone's picks on the Board.</div>
                </div>
              </div>
            )}
            <div style={{ position: "relative" }}>
              {!committed && (
                <div style={{
                  position: "absolute", inset: 0, zIndex: 5, display: "grid", placeItems: "center",
                  background: C.navbg, backdropFilter: "blur(2px)", borderRadius: 16, textAlign: "center",
                }}>
                  <div style={{ color: C.mute, fontWeight: 700, fontSize: 14, padding: 20 }}>
                    ☝️ Enter your name to start ranking
                  </div>
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 14, opacity: committed ? (picksLocked ? .7 : 1) : .45 }}>
                {GROUP_KEYS.map((gk) => (
                  <GroupCard key={gk} gk={gk} order={picks[gk]} onReorder={reorderGroup} editable={committed && !picksLocked} />
                ))}
              </div>
            </div>

            {committed && !picksLocked && (
              <button className="wc-btn" onClick={submit} style={{
                width: "100%", marginTop: 18, background: C.grad, color: "#201700", border: "none",
                borderRadius: 14, padding: "16px", fontWeight: 800, fontSize: 16, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: GRAD_SHADOW,
              }}><Save size={18} /> Save my group picks</button>
            )}

            {committed && (
              <button className="wc-btn" onClick={shareMyPicks} style={{
                width: "100%", marginTop: 10, background: "rgba(232,184,75,.10)", color: C.gold, border: `1px solid ${C.line}`,
                borderRadius: 14, padding: "14px", fontWeight: 800, fontSize: 14.5, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}><Share2 size={17} /> Share my picks</button>
            )}
          </div>
        )}

        {/* ---------------- LEADERBOARD ---------------- */}
        {view === "board" && (
          <div className="wc-fade">
            {hasMovers && (
              <div className="wc-glass" style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, padding: 14, marginBottom: 14, boxShadow: "0 8px 24px rgba(20,20,25,.07)" }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".14em", color: C.mute, marginBottom: 10 }}>TODAY'S MOVERS</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {climbers.map((m) => (
                    <div key={m.slug} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <TrendingUp size={15} color={C.pos} />
                      <span style={{ flex: 1, fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
                      <span className="wc-mono" style={{ fontWeight: 800, fontSize: 13, color: C.pos }}>▲ {m.delta}</span>
                    </div>
                  ))}
                  {fallers.map((m) => (
                    <div key={m.slug} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <TrendingDown size={15} color={C.coral} />
                      <span style={{ flex: 1, fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
                      <span className="wc-mono" style={{ fontWeight: 800, fontSize: 13, color: C.coral }}>▼ {Math.abs(m.delta)}</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 10.5, color: C.mute, marginTop: 9, opacity: .8 }}>Rank change since the start of the day (projected).</div>
              </div>
            )}
            {scopedPreds.length > 0 && (
              <>
              {hasLive && (
                <div className="wc-glass" style={{ display: "flex", gap: 5, padding: 5, background: C.soft, border: `1px solid ${C.line}`, borderRadius: 16, marginBottom: 10 }}>
                  {[["projected", "Projected"], ["official", "Official"]].map(([id, label]) => (
                    <button key={id} className="wc-btn" onClick={() => setBoardMode(id)} style={{
                      flex: 1, padding: "9px 8px", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 800, fontSize: 13,
                      background: boardMode === id ? C.grad : "transparent", color: boardMode === id ? "#201700" : C.mute,
                      boxShadow: boardMode === id ? GRAD_SHADOW : "none",
                    }}>{label}</button>
                  ))}
                </div>
              )}
              {bracketActive && (
                <div className="wc-glass" style={{ display: "flex", gap: 5, padding: 5, background: C.soft, border: `1px solid ${C.line}`, borderRadius: 16, marginBottom: 10 }}>
                  {[["overall", "Overall"], ["bracket", "Bracket only"]].map(([id, label]) => (
                    <button key={id} className="wc-btn" onClick={() => setBoardView(id)} style={{
                      flex: 1, padding: "9px 8px", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 800, fontSize: 13,
                      background: boardView === id ? C.grad : "transparent", color: boardView === id ? "#201700" : C.mute,
                      boxShadow: boardView === id ? GRAD_SHADOW : "none",
                    }}>{label}</button>
                  ))}
                </div>
              )}
              <div className="wc-glass" style={{ background: C.panel, border: `1px solid ${projecting ? C.gold : C.line}`, borderRadius: 18, padding: "8px 6px 6px", marginBottom: projecting ? 8 : 14, boxShadow: "0 8px 24px rgba(20,20,25,.07)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 12px 8px" }}>
                  <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".16em", color: C.mute }}>
                    {bv === "bracket" ? "BRACKET STANDINGS" : projecting ? "PROJECTED STANDINGS" : "STANDINGS"}{useLeague ? " · " + (identity.groupName || "League") : ""}
                  </span>
                  {projecting && bv !== "bracket" && <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 9.5, fontWeight: 800, color: C.green }}><span className="wc-pulse" /> LIVE</span>}
                </div>
                {viewStandings.map((p, i) => {
                  const medal = i === 0 ? C.gold : i === 1 ? "#9AA0A6" : i === 2 ? "#CD7F4A" : C.mute;
                  const me = identity && p.slug === identity.slug;
                  return (
                    <div key={p.slug} style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
                      borderTop: i ? `1px solid ${C.line}` : "none",
                      background: me ? "rgba(232,184,75,.08)" : "transparent",
                    }}>
                      <span className="wc-mono" style={{ width: 20, textAlign: "center", fontWeight: 700, fontSize: 15, color: medal }}>{i + 1}</span>
                      <span style={{ flex: 1, fontWeight: 700, fontSize: 15, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.name}{me ? " (you)" : ""}
                      </span>
                      <span className="wc-mono" style={{ fontWeight: 700, fontSize: 15, color: i === 0 ? C.gold : C.text }}>{viewMetric(p)} pts</span>
                    </div>
                  );
                })}
              </div>
              {(projecting || bracketActive) && (() => {
                const yi = viewStandings.findIndex((p) => identity && p.slug === identity.slug);
                if (yi < 0) return null;
                const ord = ["1st","2nd","3rd","4th","5th","6th","7th","8th","9th","10th"][yi] || `${yi + 1}th`;
                const me = viewStandings[yi], above = viewStandings[yi - 1], below = viewStandings[yi + 1];
                const tag = bv === "bracket" ? "bracket" : projecting ? "projected" : "official";
                return (
                  <div style={{ marginBottom: 14, padding: "0 2px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: C.text, fontWeight: 700 }}>
                      <TrendingUp size={14} color={C.gold} /> You're {ord} of {viewStandings.length} ({tag})
                    </div>
                    <p style={{ fontSize: 12, color: C.mute, fontWeight: 600, margin: "4px 0 0" }}>
                      {above ? `${viewMetric(above) - viewMetric(me)} pt behind ${above.name}` : "leading the pool"}{below ? `, ${viewMetric(me) - viewMetric(below)} ahead of ${below.name}` : ""}.
                    </p>
                    {projecting && bv !== "bracket" && (
                      <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: C.coral, fontWeight: 700, marginTop: 8 }}>
                        <Info size={13} /> Provisional — shifts as matches end, and counts only once groups are final.
                      </div>
                    )}
                  </div>
                );
              })()}
              </>
            )}

            <TrackerCard teamsLeft={teamsLeft} matchesLeft={matchesLeft} matchesPlayed={matchesPlayed} stageLabel={stageLabel} survivors={survivors} />

            {inLeague ? (
              <div className="wc-glass" style={{ display: "flex", gap: 5, padding: 5, background: C.soft, border: `1px solid ${C.line}`, borderRadius: 16, marginBottom: 14 }}>
                {[["global", "Global", Flag], ["league", identity.groupName || "My League", Users]].map(([id, label, Icon]) => {
                  const active = scope === id;
                  return (
                    <button key={id} className="wc-btn" onClick={() => setScope(id)} style={{
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      padding: "10px 8px", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 800, fontSize: 13,
                      background: active ? C.grad : "transparent", color: active ? "#201700" : C.mute,
                      boxShadow: active ? GRAD_SHADOW : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}><Icon size={14} /> {label}</button>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 13px", borderRadius: 12, background: "rgba(91,200,255,.06)", border: `1px solid ${C.line}`, marginBottom: 14 }}>
                <Flag size={15} color={C.blue} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, color: C.mute, fontWeight: 600 }}>
                  <b style={{ color: C.text }}>Global leaderboard.</b> Create or join a private league in the Predict tab to battle just your crew.
                </span>
              </div>
            )}

            {useLeague && (
              <div className="wc-glass" style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: C.panel, border: `1px solid rgba(91,200,255,.3)`, borderRadius: 14, marginBottom: 14 }}>
                <Users size={18} color={C.blue} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{identity.groupName || "League"}</div>
                  <div style={{ fontSize: 11.5, color: C.mute }}>Private league · ranked among friends</div>
                </div>
                <button className="wc-btn" onClick={() => copyCode(identity.groupCode)} style={{
                  display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(91,200,255,.1)", border: `1px solid rgba(91,200,255,.4)`,
                  borderRadius: 10, padding: "7px 11px", cursor: "pointer", flexShrink: 0,
                }}>
                  <span className="wc-mono" style={{ fontSize: 15, fontWeight: 700, letterSpacing: ".16em", color: C.blue }}>{identity.groupCode}</span>
                  <Copy size={13} color={C.blue} />
                </button>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, color: C.mute, fontSize: 13, fontWeight: 700, flexWrap: "wrap" }}>
              <Users size={16} /> {scopedPreds.length} {scopedPreds.length === 1 ? "entry" : "entries"}
              <span style={{ marginLeft: "auto", color: finalGroups.length ? C.gold : C.mute }}>
                {finalGroups.length}/12 groups final
              </span>
              {koScoredRounds.length > 0 && (
                <span style={{ color: C.green }}>· KO: {koScoredRounds.map((r) => r.label.replace("Round of ", "R")).join(", ")}</span>
              )}
            </div>

            {scopedPreds.length === 0 && (
              <Empty icon={Trophy} text={useLeague ? "No one in this league yet. Share your code to fill it up." : "No predictions yet. Be the first in the Predict tab."} />
            )}

            {projecting && liveBreakdown.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".12em", color: C.mute, margin: "2px 2px 10px" }}>YOUR LIVE GROUP BREAKDOWN</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {liveBreakdown.map((g) => (
                    <div key={g.gk} className="wc-glass" style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 14, boxShadow: "0 6px 18px rgba(20,20,25,.05)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <span style={{ fontWeight: 800, fontSize: 15 }}>Group {g.gk}</span>
                        {g.final ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 800, color: C.gold }}><Lock size={11} /> final</span>
                        ) : (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 800, color: C.green }}><span className="wc-pulse" /> LIVE{g.played != null ? ` · ${g.played}/${g.total}` : ""}</span>
                        )}
                        <span className="wc-mono" style={{ marginLeft: "auto", fontWeight: 700, fontSize: 14, color: C.gold }}>+{g.pts} pts</span>
                      </div>
                      {g.order.map((team, i) => {
                        const inSpot = myGroupsForProj[g.gk]?.[i] === team;
                        const hadAt = (myGroupsForProj[g.gk] || []).indexOf(team);
                        return (
                          <div key={team}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 4px" }}>
                              <span className="wc-mono" style={{ width: 16, textAlign: "center", fontWeight: 700, fontSize: 13, color: i < 2 ? C.text : C.mute }}>{i + 1}</span>
                              <span style={{ fontSize: 17 }}>{FLAG[team]}</span>
                              <span style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>{team}</span>
                              {inSpot ? (
                                <span style={{ fontSize: 10.5, fontWeight: 800, color: C.green }}>✓ your pick</span>
                              ) : (
                                <span style={{ fontSize: 10.5, fontWeight: 700, color: C.mute, opacity: .7 }}>{hadAt >= 0 ? `you had #${hadAt + 1}` : ""}</span>
                              )}
                            </div>
                            {i === 1 && (
                              <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "3px 0" }}>
                                <span style={{ flex: 1, borderTop: `1px dashed ${C.gold}`, opacity: .5 }} />
                                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".1em", color: C.gold, opacity: .8 }}>ADVANCE LINE</span>
                                <span style={{ flex: 1, borderTop: `1px dashed ${C.gold}`, opacity: .5 }} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {scopedPreds.length > 0 && liveGroups.length === 0 && (
              <>
                <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 16, marginBottom: 16 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>Scores unlock after kickoff ⚽</div>
                  <p style={{ color: C.mute, fontSize: 13, margin: 0 }}>
                    Once the host marks group results as final (Results tab), the table ranks everyone automatically. Meanwhile, here's where the {useLeague ? "league" : "pool"} is leaning:
                  </p>
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".12em", color: C.mute, marginBottom: 10 }}>MOST POPULAR PICKS TO WIN EACH GROUP</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {consensus.map((c) => (
                    <div key={c.gk} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 11 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <span className="wc-display" style={{ fontSize: 18 }}>{c.gk}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span style={{ fontSize: 18 }}>{c.team ? FLAG[c.team] : "—"}</span>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{c.team || "—"}</span>
                      </div>
                      {c.team && <div className="wc-mono" style={{ fontSize: 10.5, color: C.green, marginTop: 3 }}>{c.votes}/{scopedPreds.length} picks</div>}
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 18, fontSize: 11, fontWeight: 800, letterSpacing: ".12em", color: C.mute, marginBottom: 8 }}>WHO'S IN</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {scopedPreds.map((p) => (
                    <span key={p.slug} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 999, padding: "6px 12px", fontWeight: 700, fontSize: 13 }}>{p.name}</span>
                  ))}
                </div>
              </>
            )}

            {!projecting && finalGroups.length > 0 && scopedStandings.map((p, i) => (
              <LeaderRow key={p.slug} p={p} rank={i + 1} finalGroups={finalGroups} koScoredRounds={koScoredRounds} />
            ))}

            {picksLocked && scopedPreds.length > 0 && (
              <div style={{ marginTop: 22 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".14em", color: C.mute, margin: "0 2px 4px" }}>EVERYONE'S PICKS</div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, margin: "0 2px 12px", color: C.mute }}>
                  <Eye size={14} />
                  <span style={{ fontSize: 12, fontWeight: 600 }}>What everyone predicted. Qualifiers (top 2) are highlighted.</span>
                </div>

                <div style={{ display: "flex", gap: 6, padding: 5, background: C.soft, border: `1px solid ${C.line}`, borderRadius: 14, marginBottom: 14 }}>
                  {[["player", "By player", User], ["group", "By group", Users]].map(([id, label, Icon]) => (
                    <button key={id} className="wc-btn" onClick={() => setPeopleMode(id)} style={{
                      flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                      padding: "9px 8px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 800, fontSize: 12.5,
                      background: peopleMode === id ? C.chip : "transparent", color: peopleMode === id ? C.text : C.mute,
                      boxShadow: peopleMode === id ? "0 2px 8px rgba(20,20,25,.08)" : "none",
                    }}><Icon size={14} /> {label}</button>
                  ))}
                </div>

                {peopleMode === "player" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {scopedStandings.map((p) => {
                      const open = openPerson === p.slug;
                      const meRow = identity && p.slug === identity.slug;
                      return (
                        <div key={p.slug} style={{ background: C.panel, border: `1px solid ${open ? C.gold : C.line}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 6px 18px rgba(20,20,25,.05)" }}>
                          <button className="wc-btn" onClick={() => setOpenPerson(open ? null : p.slug)} style={{
                            width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "13px 15px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left",
                          }}>
                            <div style={{ width: 34, height: 34, borderRadius: 999, background: meRow ? C.grad : C.panel2, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 14, color: meRow ? "#201700" : C.mute, flexShrink: 0 }}>
                              {(p.name || "?")[0].toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 800, fontSize: 15 }}>{p.name}{meRow ? " (you)" : ""}</div>
                              <div style={{ fontSize: 11.5, color: C.mute, fontWeight: 600 }}>Tap to see all 12 group picks</div>
                            </div>
                            <ChevronDown size={18} color={C.mute} style={{ transform: open ? "rotate(180deg)" : "none", transition: ".2s", flexShrink: 0 }} />
                          </button>
                          {open && (
                            <div style={{ padding: "2px 15px 15px", display: "flex", flexDirection: "column", gap: 11 }}>
                              {GROUP_KEYS.map((g) => (
                                <div key={g}>
                                  <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".1em", color: C.mute, marginBottom: 5 }}>GROUP {g}</div>
                                  <PickRow order={p.groups[g] || GROUPS[g]} />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {peopleMode === "group" && (
                  <div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                      {GROUP_KEYS.map((g) => (
                        <button key={g} className="wc-btn" onClick={() => setPeopleGroup(g)} style={{
                          width: 34, height: 34, borderRadius: 10, border: `1px solid ${peopleGroup === g ? C.gold : C.line}`, cursor: "pointer",
                          fontWeight: 800, fontSize: 13, background: peopleGroup === g ? C.grad : "transparent", color: peopleGroup === g ? "#201700" : C.mute,
                        }}>{g}</button>
                      ))}
                    </div>
                    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: "8px 14px 12px", boxShadow: "0 6px 18px rgba(20,20,25,.05)" }}>
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".12em", color: C.mute, padding: "8px 0 4px" }}>GROUP {peopleGroup} — WHO PICKED WHAT</div>
                      {scopedStandings.map((p, idx) => {
                        const meRow = identity && p.slug === identity.slug;
                        return (
                          <div key={p.slug} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: idx ? `1px solid ${C.line}` : "none" }}>
                            <span style={{ width: 64, fontWeight: 800, fontSize: 12.5, color: meRow ? C.gold : C.text, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}{meRow ? " *" : ""}</span>
                            <PickRow order={p.groups[peopleGroup] || GROUPS[peopleGroup]} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ---------------- RESULTS (admin) ---------------- */}
        {view === "results" && (
          <div className="wc-fade">
            {!isAdmin ? (
              <div className="wc-glass" style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, padding: 24, textAlign: "center" }}>
                <Lock size={30} color={C.gold} style={{ margin: "0 auto" }} />
                <div style={{ fontWeight: 800, fontSize: 16, marginTop: 10 }}>Host only</div>
                <p style={{ color: C.mute, fontSize: 13, maxWidth: 360, margin: "8px auto 0" }}>
                  Only the pool host can enter or sync results, so nobody else can change the scores.
                </p>
              </div>
            ) : (
              <>
                <div className="wc-glass" style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, padding: 16, marginBottom: 16, boxShadow: "0 8px 24px rgba(20,20,25,.07)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 11, background: "rgba(232,184,75,.14)", border: `1px solid ${C.gold}`, display: "grid", placeItems: "center", flexShrink: 0 }}>
                      <Zap size={18} color={C.gold} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>Auto-sync live results</div>
                      <div style={{ fontSize: 11.5, color: C.mute }}>Pulls current standings &amp; knockout outcomes from the web.</div>
                    </div>
                    <button className="wc-btn" onClick={autoSync} disabled={syncing} style={{
                      display: "inline-flex", alignItems: "center", gap: 7, background: C.grad, color: "#201700", border: "none",
                      borderRadius: 11, padding: "10px 14px", fontWeight: 800, fontSize: 13, cursor: syncing ? "default" : "pointer",
                      boxShadow: GRAD_SHADOW, opacity: syncing ? .7 : 1, flexShrink: 0,
                    }}>
                      <RefreshCw size={15} className={syncing ? "wc-spin" : ""} />{syncing ? "Syncing…" : "Sync now"}
                    </button>
                  </div>
                  {syncMsg && <p style={{ fontSize: 12, color: C.mute, margin: "10px 0 0", fontWeight: 600 }}>{syncMsg}</p>}
                  {lastSync && <p style={{ fontSize: 10.5, color: C.mute, margin: "4px 0 0", opacity: .8 }}>Last synced {new Date(lastSync).toLocaleTimeString()}</p>}
                  <p style={{ fontSize: 10.5, color: C.mute, margin: "8px 0 0", opacity: .8 }}>
                    Best-effort from public sources — double-check below and tweak anything that looks off.
                  </p>
                </div>

                <div className="wc-glass" style={{ background: C.panel, border: `1px solid ${picksLocked ? C.coral : C.line}`, borderRadius: 18, padding: 16, marginBottom: 16, boxShadow: "0 8px 24px rgba(20,20,25,.07)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 11, background: picksLocked ? "rgba(217,84,74,.12)" : C.soft, border: `1px solid ${picksLocked ? C.coral : C.line}`, display: "grid", placeItems: "center", flexShrink: 0 }}>
                      {picksLocked ? <Lock size={18} color={C.coral} /> : <Unlock size={18} color={C.mute} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>{picksLocked ? "Group picks are locked" : "Group picks are open"}</div>
                      <div style={{ fontSize: 11.5, color: C.mute }}>{picksLocked ? "Players can't change their group order." : "Lock once games start so no one edits after kickoff."}</div>
                    </div>
                    <button className="wc-btn" onClick={toggleLock} style={{
                      display: "inline-flex", alignItems: "center", gap: 7, border: "none",
                      borderRadius: 11, padding: "10px 14px", fontWeight: 800, fontSize: 13, cursor: "pointer", flexShrink: 0,
                      background: picksLocked ? C.soft : C.grad, color: picksLocked ? C.text : "#201700",
                      boxShadow: picksLocked ? "none" : GRAD_SHADOW,
                    }}>
                      {picksLocked ? <><Unlock size={15} /> Unlock</> : <><Lock size={15} /> Lock picks</>}
                    </button>
                  </div>
                </div>

                <div className="wc-glass" style={{ background: C.panel, border: `1px solid ${bracket?.locked ? C.gold : C.line}`, borderRadius: 18, padding: 16, marginBottom: 16, boxShadow: "0 8px 24px rgba(20,20,25,.07)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: bracket?.seeds?.length ? 12 : 0 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 11, background: "rgba(232,184,75,.12)", border: `1px solid ${C.gold}`, display: "grid", placeItems: "center", flexShrink: 0 }}>
                      <GitBranch size={18} color={C.gold} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>Knockout bracket</div>
                      <div style={{ fontSize: 11.5, color: C.mute }}>
                        {bracket?.seeds?.length ? `${bracket.seeds.length} matchups seeded · ${bracket.locked ? "locked" : "open for picks"}` : "No field yet — load a sample to test, or wait for the group stage to end."}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {!bracket?.seeds?.length ? (
                      <button className="wc-btn" onClick={loadSampleTest} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "none", borderRadius: 11, padding: "10px 14px", fontWeight: 800, fontSize: 13, cursor: "pointer", background: C.grad, color: "#201700", boxShadow: GRAD_SHADOW }}>
                        Load sample field + results (test)
                      </button>
                    ) : (
                      <>
                        <button className="wc-btn" onClick={toggleBracketLock} style={{
                          display: "inline-flex", alignItems: "center", gap: 7, border: "none", borderRadius: 11, padding: "10px 14px", fontWeight: 800, fontSize: 13, cursor: "pointer",
                          background: bracket.locked ? C.soft : C.grad, color: bracket.locked ? C.text : "#201700", boxShadow: bracket.locked ? "none" : GRAD_SHADOW,
                        }}>{bracket.locked ? <><Unlock size={15} /> Unlock bracket</> : <><Lock size={15} /> Lock bracket</>}</button>
                        <button className="wc-btn" onClick={clearBracket} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${C.line}`, borderRadius: 11, padding: "10px 14px", fontWeight: 800, fontSize: 13, cursor: "pointer", background: "transparent", color: C.mute }}>
                          <RotateCcw size={14} /> Clear field
                        </button>
                      </>
                    )}
                  </div>
                  <p style={{ fontSize: 10.5, color: C.mute, margin: "10px 0 0", opacity: .8 }}>
                    Stage 2 (testing): sample loader fills a field + fake results so you can see bracket scoring on the Board. Real seeding from live results comes in Stage 3.
                  </p>
                </div>

                <PhaseToggle phase={phase} setPhase={setPhase} koLocked={false} />

                {phase === "group" && (
                  <>
                    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 12, marginBottom: 16, display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <Info size={16} color={C.gold} style={{ flexShrink: 0, marginTop: 2 }} />
                      <p style={{ margin: 0, fontSize: 12.5, color: C.mute }}>
                        Reorder each group to its current positions and set how many of its 6 matches have been <b>played</b> — that drives the live projection. Toggle <b>Final</b> (locks it at 6 played) to score it for real. Auto-sync fills this in for you once matches start.
                      </p>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {GROUP_KEYS.map((gk) => {
                        const setPlayed = (v) => setResultsDraft((d) => ({ ...d, [gk]: { ...d[gk], played: Math.max(0, Math.min(6, v)) } }));
                        const pl = resultsDraft[gk].played || 0;
                        const fin = resultsDraft[gk].final;
                        return (
                        <GroupCard key={gk} gk={gk} order={resultsDraft[gk].order} onReorder={reorderResult} editable
                          headerRight={
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              {!fin && (
                                <div style={{ display: "inline-flex", alignItems: "center", gap: 4, border: `1px solid ${C.line}`, borderRadius: 999, padding: "2px 4px" }}>
                                  <button className="wc-btn" onClick={() => setPlayed(pl - 1)} style={{ width: 22, height: 22, borderRadius: 999, border: "none", background: C.soft, color: C.text, fontWeight: 800, fontSize: 15, cursor: "pointer", lineHeight: 1 }}>−</button>
                                  <span className="wc-mono" style={{ fontSize: 11.5, fontWeight: 700, minWidth: 30, textAlign: "center", color: pl > 0 ? C.green : C.mute }}>{pl}/6</span>
                                  <button className="wc-btn" onClick={() => setPlayed(pl + 1)} style={{ width: 22, height: 22, borderRadius: 999, border: "none", background: C.soft, color: C.text, fontWeight: 800, fontSize: 15, cursor: "pointer", lineHeight: 1 }}>+</button>
                                </div>
                              )}
                              <button className="wc-btn" onClick={() => setResultsDraft((d) => ({ ...d, [gk]: { ...d[gk], final: !d[gk].final, played: !d[gk].final ? 6 : d[gk].played } }))}
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 800,
                                  padding: "6px 10px", borderRadius: 999, cursor: "pointer",
                                  border: `1px solid ${fin ? C.green : C.line}`,
                                  background: fin ? "rgba(232,184,75,.12)" : "transparent",
                                  color: fin ? C.green : C.mute,
                                }}>
                                {fin ? <Lock size={13} /> : <Unlock size={13} />}
                                {fin ? "Final" : "Mark final"}
                              </button>
                            </div>
                          } />
                        );
                      })}
                    </div>
                    <button className="wc-btn" onClick={saveResults} style={{
                      width: "100%", marginTop: 18, background: C.grad, color: "#201700", border: "none",
                      borderRadius: 14, padding: "16px", fontWeight: 800, fontSize: 16, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: GRAD_SHADOW,
                    }}><Save size={18} /> Save results & score the pool</button>
                  </>
                )}

                {phase === "knockout" && (
                  <>
                    {!allGroupsFinal ? (
                      <div className="wc-glass" style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, padding: 20, textAlign: "center", color: C.mute }}>
                        <Lock size={26} style={{ margin: "0 auto", opacity: .7 }} />
                        <p style={{ marginTop: 10, fontSize: 13.5, fontWeight: 600 }}>
                          Mark all 12 groups <b>Final</b> on the Group Stage tab first. Then set up the knockout bracket here.
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Step 1: pick the 8 qualifying third-place teams */}
                        <div className="wc-glass" style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, padding: 16, marginBottom: 14 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span className="wc-display" style={{ fontSize: 18 }}>1. Best third-place teams</span>
                            <span className="wc-mono" style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: koDraft.thirds.length === 8 ? C.green : C.gold }}>{koDraft.thirds.length}/8</span>
                          </div>
                          <p style={{ fontSize: 12, color: C.mute, margin: "0 0 12px" }}>
                            8 of the 12 third-place teams advance. Select the 8 that qualified.
                          </p>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {thirdTeams.map((team, idx) => {
                              const on = koDraft.thirds.includes(team);
                              const full = !on && koDraft.thirds.length >= 8;
                              return (
                                <button key={team} className="wc-btn" disabled={full} onClick={() => toggleThird(team)} style={{
                                  display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 12px", borderRadius: 999,
                                  fontSize: 13, fontWeight: 700, cursor: full ? "default" : "pointer",
                                  border: `1px solid ${on ? C.gold : C.line}`,
                                  background: on ? C.gold : C.soft,
                                  color: on ? "#1a1500" : (full ? "rgba(139,157,150,.5)" : C.text), opacity: full ? .5 : 1,
                                }}>
                                  <span style={{ fontSize: 10, fontWeight: 800, opacity: .7 }}>{GROUP_KEYS[idx]}</span>
                                  <span style={{ fontSize: 15 }}>{FLAG[team] || "🏳️"}</span>{team}
                                  {on && <Check size={13} />}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Step 2: open predictions */}
                        <div className="wc-glass" style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, padding: 16, marginBottom: 14, display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <div className="wc-display" style={{ fontSize: 18 }}>2. Open predictions</div>
                            <p style={{ fontSize: 12, color: C.mute, margin: "2px 0 0" }}>Let everyone make their knockout picks.</p>
                          </div>
                          <button className="wc-btn" disabled={koDraft.thirds.length !== 8}
                            onClick={() => setKoDraft((d) => ({ ...d, open: !d.open }))} style={{
                              display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 800,
                              padding: "9px 14px", borderRadius: 999, cursor: koDraft.thirds.length === 8 ? "pointer" : "default",
                              border: `1px solid ${koDraft.open ? C.green : C.line}`,
                              background: koDraft.open ? "rgba(232,184,75,.12)" : "transparent",
                              color: koDraft.open ? C.green : C.mute, opacity: koDraft.thirds.length === 8 ? 1 : .5,
                            }}>{koDraft.open ? <Unlock size={14} /> : <Lock size={14} />}{koDraft.open ? "Open" : "Closed"}</button>
                        </div>

                        {/* Step 3: actual results */}
                        <div style={{ marginBottom: 12 }}>
                          <div className="wc-display" style={{ fontSize: 18, marginBottom: 2 }}>3. Actual results</div>
                          <p style={{ fontSize: 12, color: C.mute, margin: 0 }}>Tap the teams that actually advanced, then mark each round <b>Official</b> to score it.</p>
                        </div>
                        <KnockoutBoard pool={koPoolDraft} ko={koDraft.actual} onToggle={toggleKoActual} editable
                          showFinals finals={koDraft.finals} onToggleFinal={toggleKoFinal} />

                        <button className="wc-btn" onClick={saveKnockout} style={{
                          width: "100%", marginTop: 18, background: C.grad, color: "#201700", border: "none",
                          borderRadius: 14, padding: "16px", fontWeight: 800, fontSize: 16, cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: GRAD_SHADOW,
                        }}><Save size={18} /> Save knockout & score the pool</button>
                      </>
                    )}
                  </>
                )}
                <button className="wc-btn" onClick={resetAll} style={{
                  width: "100%", marginTop: 10, background: "transparent", color: C.coral, border: `1px solid ${C.line}`,
                  borderRadius: 12, padding: "12px", fontWeight: 700, fontSize: 13, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}><RotateCcw size={15} /> Reset entire pool</button>
              </>
            )}
          </div>
        )}

        {/* ---------------- BRACKET ---------------- */}
        {view === "bracket" && (
          <div className="wc-fade">
            {!(bracket?.seeds?.length) ? (
              <div className="wc-glass" style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, padding: 24, textAlign: "center", color: C.mute }}>
                <Lock size={28} style={{ margin: "0 auto", opacity: .7 }} />
                <div style={{ fontWeight: 800, fontSize: 16, color: C.text, marginTop: 10 }}>Knockout bracket unlocks soon</div>
                <p style={{ marginTop: 8, fontSize: 13.5, fontWeight: 600, maxWidth: 360, marginLeft: "auto", marginRight: "auto" }}>
                  When the group stage wraps up and the 32 teams are set, the host opens the bracket and you'll fill it out here. Your group-stage points carry over.
                </p>
              </div>
            ) : !committed ? (
              <div className="wc-glass" style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, padding: 18, textAlign: "center", color: C.mute, fontSize: 13, fontWeight: 600 }}>
                Set your name on the Group Stage tab to fill out your bracket.
              </div>
            ) : (
              <>
                {bracket.locked ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 14px", borderRadius: 14, marginBottom: 14, background: "rgba(232,184,75,.10)", border: `1px solid ${C.gold}` }}>
                    <Lock size={16} color={C.gold} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>The bracket is locked — these are your final picks.</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 7, color: C.mute, fontSize: 12.5, fontWeight: 600, marginBottom: 12 }}>
                    <Trophy size={15} style={{ color: C.gold }} />
                    Tap who advances in each matchup, round by round, down to your champion.
                  </div>
                )}
                <BracketColumns seeds={bracket.seeds} picks={koBracket} onPick={handleBracketPick} locked={!!bracket.locked} />
                {!bracket.locked && (
                  <button className="wc-btn" onClick={saveBracket} style={{
                    width: "100%", marginTop: 18, background: C.grad, color: "#201700", border: "none",
                    borderRadius: 14, padding: "16px", fontWeight: 800, fontSize: 16, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: GRAD_SHADOW,
                  }}><Save size={18} /> Save my bracket</button>
                )}
              </>
            )}
          </div>
        )}
        </>
        )}
      </main>

      {/* Scoring modal */}
      {showScoring && (
        <div onClick={() => setShowScoring(false)} style={{
          position: "fixed", inset: 0, zIndex: 60, background: "rgba(26,23,18,.42)",
          display: "grid", placeItems: "center", padding: 16,
        }}>
          <div className="wc-pop wc-glass" onClick={(e) => e.stopPropagation()} style={{
            background: C.card, border: `1px solid ${C.line}`, borderRadius: 22, padding: 22, maxWidth: 440, width: "100%",
            maxHeight: "88vh", overflowY: "auto", WebkitOverflowScrolling: "touch",
            boxShadow: "0 30px 80px rgba(20,20,25,.18)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 className="wc-display" style={{ fontSize: 26, margin: 0 }}>SCORING</h2>
              <button className="wc-btn" onClick={() => setShowScoring(false)} style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8, padding: 6, color: C.text, cursor: "pointer" }}><X size={18} /></button>
            </div>
            <p style={{ color: C.mute, fontSize: 13, marginTop: 0 }}>Points are awarded per group based on your predicted final order vs the real standings:</p>
            <ScoreLine icon={Medal} color={C.green} pts={`+${PTS_EXACT}`} label="Each team in its exact finishing position" sub="Any of the 4 spots — spot on (max +12)" />
            <ScoreLine icon={ShieldCheck} color={C.blue} pts={`+${PTS_QUALIFIERS}`} label="Both top-2 teams correct" sub="Your two qualifiers, any order" />
            <ScoreLine icon={Crown} color={C.gold} pts={`+${PTS_PERFECT}`} label="All 4 positions perfectly correct" sub="Bonus for nailing the whole group" />
            <div style={{ marginTop: 14, padding: 12, background: C.panel2, borderRadius: 10, border: `1px solid ${C.line}` }}>
              <div className="wc-mono" style={{ fontSize: 13, color: C.gold, fontWeight: 700 }}>Group stage — max 17 / group · 204 total</div>
              <p style={{ fontSize: 12, color: C.mute, margin: "6px 0 0" }}>
                A perfect group is 12 (exact spots) + 2 (top-2) + 3 (perfect bonus) = 17. Only groups marked <b>Final</b> are counted.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "20px 0 6px" }}>
              <Trophy size={16} color={C.gold} />
              <h3 className="wc-display" style={{ fontSize: 18, margin: 0 }}>Knockout bracket</h3>
            </div>
            <p style={{ color: C.mute, fontSize: 13, marginTop: 0 }}>
              When the group stage ends, you'll fill out the full 32-team bracket — Round of 32 all the way to the champion. You score a round whenever a team you advanced actually reaches it (slot-based), with later rounds worth more:
            </p>
            {[
              { label: "Round of 32", count: 16, pts: 3, color: "#9AA0A6" },
              { label: "Round of 16", count: 8, pts: 5, color: "#7FB5E6" },
              { label: "Quarterfinals", count: 4, pts: 9, color: "#5FC076" },
              { label: "Semifinals", count: 2, pts: 16, color: "#E0A34A" },
              { label: "Champion (wins it all)", count: 1, pts: 30, color: "#F4D98A" },
              { label: "Final matchup (both finalists right)", count: 0, pts: 18, color: C.gold },
            ].map((r) => (
              <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: `1px solid ${C.line}` }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: r.color, flexShrink: 0 }} />
                <div style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>{r.label}{r.count > 0 && <span style={{ color: C.mute, fontWeight: 600 }}> · {r.count} {r.count === 1 ? "pick" : "picks"}</span>}</div>
                <div className="wc-mono" style={{ fontWeight: 700, fontSize: 16, color: r.color }}>+{r.pts}</div>
              </div>
            ))}
            <div style={{ marginTop: 12, padding: 12, background: C.panel2, borderRadius: 10, border: `1px solid ${C.line}` }}>
              <div className="wc-mono" style={{ fontSize: 13, color: C.gold, fontWeight: 700 }}>Bracket — 204 max · 408 grand total</div>
              <p style={{ fontSize: 12, color: C.mute, margin: "6px 0 0" }}>
                The bracket is worth as much as the group stage, so the knockouts can decide the title. The +30 (your champion wins it all) and +18 (you picked both finalists) are independent — earn either or both. Picks lock before the Round of 32 kicks off, and if a team you advanced loses, the picks that needed them score nothing.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="wc-pop" style={{
          position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", zIndex: 70,
          background: C.text, color: C.bg, padding: "12px 20px", borderRadius: 999, fontWeight: 800,
          fontSize: 14, boxShadow: "0 8px 30px rgba(20,20,25,.16)", whiteSpace: "nowrap",
        }}>{toast}</div>
      )}

      {!storageReady && (
        <div style={{ position: "fixed", top: 8, left: "50%", transform: "translateX(-50%)", zIndex: 80, fontSize: 11, color: C.coral, background: C.panel, padding: "4px 10px", borderRadius: 8, border: `1px solid ${C.line}` }}>
          Add your Supabase keys to .env to enable shared data &amp; leaderboards
        </div>
      )}
    </div>
  );
}

function ScoreLine({ icon: Icon, color, pts, label, sub }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${C.line}` }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, display: "grid", placeItems: "center", background: C.soft, border: `1px solid ${C.line}`, flexShrink: 0 }}>
        <Icon size={18} color={color} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{label}</div>
        <div style={{ fontSize: 12, color: C.mute }}>{sub}</div>
      </div>
      <div className="wc-mono" style={{ fontWeight: 700, fontSize: 18, color }}>{pts}</div>
    </div>
  );
}

function Empty({ icon: Icon, text }) {
  return (
    <div style={{ textAlign: "center", padding: "50px 20px", color: C.mute }}>
      <Icon size={34} style={{ margin: "0 auto", opacity: .6 }} />
      <p style={{ marginTop: 12, fontSize: 14, fontWeight: 600 }}>{text}</p>
    </div>
  );
}

function LeaderRow({ p, rank, finalGroups, koScoredRounds }) {
  const [open, setOpen] = useState(false);
  const medal = rank === 1 ? C.gold : rank === 2 ? "#9AA0A6" : rank === 3 ? "#CD7F4A" : C.mute;
  const hasKo = koScoredRounds.length > 0;
  return (
    <div className="wc-fade wc-glass" style={{ background: C.panel, border: `1px solid ${rank === 1 ? C.gold : C.line}`, borderRadius: 18, marginBottom: 10, overflow: "hidden", boxShadow: rank === 1 ? "0 10px 30px rgba(232,184,75,.14)" : "0 6px 18px rgba(20,20,25,.08)" }}>
      <button className="wc-btn" onClick={() => setOpen((o) => !o)} style={{
        width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 14px",
        background: "transparent", border: "none", cursor: "pointer", color: C.text, textAlign: "left",
      }}>
        <div className="wc-display" style={{ fontSize: 26, width: 34, textAlign: "center", color: medal }}>{rank}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{p.name}</div>
          <div style={{ fontSize: 11.5, color: C.mute }}>
            {hasKo ? <>Group {p.groupPts} · Knockout {p.koPts}</> : <>{open ? "Hide" : "Tap for"} group breakdown</>}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="wc-mono" style={{ fontSize: 24, fontWeight: 700, color: rank === 1 ? C.gold : C.green, lineHeight: 1 }}>{p.total}</div>
          <div style={{ fontSize: 10.5, color: C.mute, fontWeight: 700 }}>POINTS</div>
        </div>
      </button>
      {open && (
        <div style={{ padding: "0 14px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".12em", color: C.mute, margin: "0 0 6px" }}>GROUPS</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 6 }}>
            {finalGroups.map((k) => (
              <div key={k} style={{ background: C.panel2, borderRadius: 8, padding: "7px 4px", textAlign: "center", border: `1px solid ${C.line}` }}>
                <div className="wc-display" style={{ fontSize: 14, color: C.mute }}>{k}</div>
                <div className="wc-mono" style={{ fontSize: 14, fontWeight: 700, color: p.per[k] > 0 ? C.green : C.mute }}>{p.per[k]}</div>
              </div>
            ))}
          </div>
          {hasKo && (
            <>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".12em", color: C.mute, margin: "12px 0 6px" }}>KNOCKOUT</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {koScoredRounds.map((r) => (
                  <div key={r.key} style={{ background: C.panel2, borderRadius: 8, padding: "6px 10px", border: `1px solid ${C.line}`, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: r.color }} />
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: C.mute }}>{r.label}</span>
                    <span className="wc-mono" style={{ fontSize: 13, fontWeight: 700, color: (p.koPer?.[r.key] || 0) > 0 ? C.green : C.mute }}>{p.koPer?.[r.key] || 0}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
