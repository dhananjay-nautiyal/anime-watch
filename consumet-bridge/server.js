'use strict';

const express = require('express');
const cors = require('cors');
const { ANIME } = require('@consumet/extensions');

const app = express();
app.use(cors());
app.use(express.json());

const hianime = new ANIME.Hianime();
const ok = res => res.json({ status: 'running', provider: 'hianime' });
const fail = (res, code, err) => {
  console.warn('[bridge]', code, err && err.message ? err.message : err);
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
    const data = await hianime.fetchAnimeInfo(String(req.query.id));
    res.json(data);
  } catch (err) { fail(res, 'INFO_FAILED', err); }
});

// GET /anime/hianime/servers?episodeId=... -> available servers
app.get('/anime/hianime/servers', async (req, res) => {
  try {
    if (!req.query.episodeId) return res.status(400).json({ error: 'MISSING_EPISODE_ID' });
    const data = await hianime.fetchEpisodeServers(String(req.query.episodeId));
    res.json(data);
  } catch (err) { fail(res, 'SERVERS_FAILED', err); }
});

// GET /anime/hianime/:query  -> search
app.get('/anime/hianime/:query', async (req, res) => {
  try {
    const data = await hianime.search(decodeURIComponent(req.params.query));
    res.json(data);
  } catch (err) { fail(res, 'SEARCH_FAILED', err); }
});

// GET /anime/hianime/watch/:episodeId?server=vidcloud&category=sub -> sources
app.get('/anime/hianime/watch/:episodeId', async (req, res) => {
  try {
    const data = await hianime.fetchEpisodeSources(
      decodeURIComponent(req.params.episodeId),
      String(req.query.server || ''),
      String(req.query.category || 'sub'),
    );
    res.json(data);
  } catch (err) { fail(res, 'WATCH_FAILED', err); }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`[bridge] listening on :${port}`));
