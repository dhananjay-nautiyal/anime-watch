'use strict';

const express = require('express');
const cors = require('cors');
const { ANIME } = require('@consumet/extensions');

const app = express();
app.use(cors());
app.use(express.json());

const hianime = new ANIME.Hianime();
const ORDER = ['hianime', 'animekai', 'animepahe'];

function getProvider(name) {
  if (name === 'animekai') return new ANIME.AnimeKai();
  if (name === 'animepahe') return new ANIME.AnimePahe();
  return new ANIME.Hianime();
}

// Normalize one info payload to the bridge shape. Episode ids carry their
// provider prefix so /watch can route without extra state.
function normalizeInfo(provider, info) {
  const episodes = (info.episodes || [])
    .filter(e => e && e.id)
    .map(e => ({
      id: `${provider}:${e.id}`,
      number: e.number || 0,
      title: e.title || null,
    }));
  return {
    provider,
    id: info.id,
    title: info.title,
    image: info.image || null,
    totalEpisodes: info.totalEpisodes || episodes.length,
    episodes,
  };
}

function pickBest(title, results) {
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const want = norm(title);
  const byExact = results.find(r => norm(r.title) === want);
  if (byExact) return byExact;
  const byEdge = results.find(r => {
    const t = norm(r.title);
    return t.startsWith(want) || want.startsWith(t);
  });
  if (byEdge) return byEdge;
  return results.find(r => norm(r.title).includes(want)) || results[0];
}

// GET /anime/resolve?q=... -> search + info atomically across providers.
// Returns the first provider with a match AND a non-empty episode list.
app.get('/anime/resolve', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'MISSING_Q' });
  const attempts = [];
  for (const name of ORDER) {
    try {
      const p = getProvider(name);
      const s = await p.search(q);
      const results = (s && s.results) || [];
      if (!results.length) { attempts.push({ provider: name, error: 'NO_MATCH' }); continue; }
      const best = pickBest(q, results);
      const info = await p.fetchAnimeInfo(best.id);
      const norm = normalizeInfo(name, info);
      if (!norm.episodes.length) { attempts.push({ provider: name, error: 'NO_EPISODES' }); continue; }
      return res.json(norm);
    } catch (err) {
      attempts.push({ provider: name, error: String((err && err.message) || err).slice(0, 160) });
    }
  }
  console.warn('[bridge] RESOLVE_FAILED', JSON.stringify({ q, attempts }).slice(0, 500));
  res.status(502).json({ error: 'RESOLVE_FAILED', attempts });
});
const ok = res => res.json({ status: 'running', provider: 'hianime' });
const fail = (res, code, err) => {
  const detail = {
    message: err && err.message ? err.message : String(err),
    name: err && err.name,
    cause: err && err.cause ? String(err.cause).slice(0, 300) : undefined,
    status: err && (err.status || err.statusCode || err.response?.status),
    stack: err && err.stack ? String(err.stack).split('\n').slice(0, 4).join(' | ') : undefined,
  };
  console.warn('[bridge]', code, JSON.stringify(detail).slice(0, 600));
  res.status(502).json({ error: code, message: String((err && err.message) || err || 'upstream failed') });
};

app.get('/', (req, res) => ok(res));
app.get('/health', (req, res) => ok(res));

// NOTE: specific routes BEFORE /:query — Express matches in registration
// order, otherwise "info" would be treated as a search term.

// GET /anime/hianime/info?id=... -> anime info + episodes
app.get('/anime/hianime/info', async (req, res) => {
  try {
    if (!req.query.id) return res.status(400).json({ error: 'MISSING_ID' });
    const data = await getProvider('hianime').fetchAnimeInfo(String(req.query.id));
    res.json(data);
  } catch (err) { fail(res, 'INFO_FAILED', err); }
});

// GET /anime/hianime/servers?episodeId=... -> available servers
app.get('/anime/hianime/servers', async (req, res) => {
  try {
    if (!req.query.episodeId) return res.status(400).json({ error: 'MISSING_EPISODE_ID' });
    const data = await getProvider('hianime').fetchEpisodeServers(String(req.query.episodeId));
    res.json(data);
  } catch (err) { fail(res, 'SERVERS_FAILED', err); }
});

// Provider-pinned routes (single source; prefer /resolve for fallback).
app.get('/anime/hianime/:query', async (req, res) => {
  try {
    const data = await getProvider('hianime').search(decodeURIComponent(req.params.query));
    res.json(data);
  } catch (err) { fail(res, 'SEARCH_FAILED', err); }
});

// GET /anime/hianime/watch/:episodeId?server=vidcloud&category=sub -> sources
// episodeId may carry a "provider:" prefix (from /resolve); unprefixed
// ids default to hianime for backward compatibility.
app.get('/anime/hianime/watch/:episodeId', async (req, res) => {
  try {
    let raw = decodeURIComponent(req.params.episodeId);
    let name = 'hianime';
    const cut = raw.indexOf(':');
    if (cut > 0 && ORDER.includes(raw.slice(0, cut))) {
      name = raw.slice(0, cut);
      raw = raw.slice(cut + 1);
    }
    const p = getProvider(name);
    const data = await p.fetchEpisodeSources(
      raw,
      String(req.query.server || ''),
      String(req.query.category || 'sub'),
    );
    res.json({ provider: name, ...data });
  } catch (err) { fail(res, 'WATCH_FAILED', err); }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`[bridge] listening on :${port}`));
