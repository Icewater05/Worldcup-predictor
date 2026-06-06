// Drop-in replacement for the Claude artifact's window.storage.
// Shared data (predictions, results, knockout, leagues) lives in a Supabase
// "kv" table so it syncs across everyone. Personal/per-device data (which name
// this device owns) stays in localStorage — no login required.

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Whether shared storage is configured. The app shows a banner if this is false.
export const storageReady = Boolean(url && anon);

const supa = storageReady ? createClient(url, anon) : null;

// Shared client (also used for auth + profiles). Null until env is configured.
export const supabase = supa;

const TABLE = "kv";

// ---- personal (per-device) storage via localStorage ----
const local = {
  get(k) {
    try {
      const v = localStorage.getItem(k);
      return v == null ? null : { key: k, value: v };
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {}
    return { key: k, value: v };
  },
};

export const store = {
  // ---- shared key/value (Supabase) ----
  async get(k) {
    if (!supa) return null;
    const { data, error } = await supa.from(TABLE).select("value").eq("key", k).maybeSingle();
    if (error || !data) return null;
    return { key: k, value: data.value };
  },

  async set(k, v) {
    if (!supa) return { key: k, value: v };
    await supa.from(TABLE).upsert(
      { key: k, value: v, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
    return { key: k, value: v };
  },

  async list(prefix) {
    if (!supa) return { keys: [] };
    // escape % and _ so the prefix is treated literally
    const safe = prefix.replace(/[%_]/g, (c) => `\\${c}`);
    const { data, error } = await supa.from(TABLE).select("key").like("key", `${safe}%`);
    if (error || !data) return { keys: [] };
    return { keys: data.map((r) => r.key) };
  },

  async del(k) {
    if (!supa) return { key: k, deleted: true };
    await supa.from(TABLE).delete().eq("key", k);
    return { key: k, deleted: true };
  },

  // ---- personal (per-device) ----
  async getMine(k) {
    return local.get(k);
  },
  async setMine(k, v) {
    return local.set(k, v);
  },
};
