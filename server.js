require('dotenv').config();
const express = require('express');
const axios = require('axios');
const NodeCache = require('node-cache');

const app = express();
const cache = new NodeCache();

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'free-api-live-football-data.p.rapidapi.com';
const WORLD_CUP_ID = 77;

async function fetchWithCache(url, params, ttlSeconds) {
  const cacheKey = url + JSON.stringify(params);
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const response = await axios.get(url, {
    params,
    headers: {
      'x-rapidapi-key': RAPIDAPI_KEY,
      'x-rapidapi-host': RAPIDAPI_HOST,
    },
  });

  cache.set(cacheKey, response.data, ttlSeconds);
  return response.data;
}

const BASE = `https://${RAPIDAPI_HOST}`;

// ── Root ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    app: 'Sportle',
    status: 'running',
    endpoints: [
      '/live',
      '/fixtures',
      '/fixtures/today',
      '/standings',
      '/teams',
      '/teams/:teamId',
      '/teams/:teamId/players',
      '/players/:playerId',
      '/matches/:matchId',
      '/matches/:matchId/stats',
      '/matches/:matchId/lineups',
      '/rounds',
    ]
  });
});

// ── Live scores ───────────────────────────────────────────────────────
app.get('/live', async (req, res) => {
  try {
    const data = await fetchWithCache(`${BASE}/football-current-live`, {}, 30);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch live scores', detail: err.message });
  }
});

// ── Fixtures ──────────────────────────────────────────────────────────
app.get('/fixtures', async (req, res) => {
  try {
    const data = await fetchWithCache(
      `${BASE}/football-get-all-matches-by-league`,
      { leagueid: WORLD_CUP_ID },
      3600
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch fixtures', detail: err.message });
  }
});

app.get('/fixtures/today', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const data = await fetchWithCache(
      `${BASE}/football-get-matches-by-date`,
      { date: today },
      300
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch today fixtures', detail: err.message });
  }
});

// ── Standings ─────────────────────────────────────────────────────────
app.get('/standings', async (req, res) => {
  try {
    const data = await fetchWithCache(
      `${BASE}/football-get-standing-all`,
      { leagueId: WORLD_CUP_ID },
      900
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch standings', detail: err.message });
  }
});

// ── Teams ─────────────────────────────────────────────────────────────
app.get('/teams', async (req, res) => {
  try {
    const data = await fetchWithCache(
      `${BASE}/football-get-list-all-team`,
      { leagueid: WORLD_CUP_ID },
      86400
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch teams', detail: err.message });
  }
});

app.get('/teams/:teamId', async (req, res) => {
  try {
    const data = await fetchWithCache(
      `${BASE}/football-league-team`,
      { teamid: req.params.teamId },
      86400
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch team', detail: err.message });
  }
});

// ── Players ───────────────────────────────────────────────────────────
app.get('/teams/:teamId/players', async (req, res) => {
  try {
    const data = await fetchWithCache(
      `${BASE}/football-get-list-player`,
      { teamid: req.params.teamId },
      86400
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch squad', detail: err.message });
  }
});

app.get('/players/:playerId', async (req, res) => {
  try {
    const data = await fetchWithCache(
      `${BASE}/football-get-player-detail`,
      { playerid: req.params.playerId },
      86400
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch player', detail: err.message });
  }
});

// ── Match detail ──────────────────────────────────────────────────────
app.get('/matches/:matchId', async (req, res) => {
  try {
    const data = await fetchWithCache(
      `${BASE}/football-get-match-detail`,
      { eventid: req.params.matchId },
      30
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch match', detail: err.message });
  }
});

// ── Match stats ───────────────────────────────────────────────────────
app.get('/matches/:matchId/stats', async (req, res) => {
  try {
    const data = await fetchWithCache(
      `${BASE}/football-get-match-all-stats`,
      { eventid: req.params.matchId },
      30
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch match stats', detail: err.message });
  }
});

// ── Match lineups ─────────────────────────────────────────────────────
app.get('/matches/:matchId/lineups', async (req, res) => {
  try {
    const [home, away] = await Promise.all([
      fetchWithCache(`${BASE}/football-get-hometeam-lineup`, { eventid: req.params.matchId }, 300),
      fetchWithCache(`${BASE}/football-get-awayteam-lineup`, { eventid: req.params.matchId }, 300),
    ]);
    res.json({ home, away });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch lineups', detail: err.message });
  }
});

// ── Rounds ────────────────────────────────────────────────────────────
app.get('/rounds', async (req, res) => {
  try {
    const data = await fetchWithCache(
      `${BASE}/football-get-all-rounds`,
      { leagueid: WORLD_CUP_ID },
      3600
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch rounds', detail: err.message });
  }
});

const PORT = process.env.PORT || 3000;

app.get('/debug', async (req, res) => {
  const results = {};
  
  const attempts = [
    { key: 'eventid', val: '5498260' },
    { key: 'eventId', val: '5498260' },
    { key: 'matchid', val: '5498260' },
    { key: 'matchId', val: '5498260' },
  ];

  for (const a of attempts) {
    try {
      const r = await axios.get(`https://${RAPIDAPI_HOST}/football-get-match-all-stats`, {
        params: { [a.key]: a.val },
        headers: {
          'x-rapidapi-key': RAPIDAPI_KEY,
          'x-rapidapi-host': RAPIDAPI_HOST,
        },
      });
      results[a.key] = r.data?.status || r.data;
    } catch (e) {
      results[a.key] = e.response?.data || e.message;
    }
  }

  const roundAttempts = [
    { key: 'leagueid', val: 77 },
    { key: 'leagueId', val: 77 },
    { key: 'leagueid', val: '77' },
  ];

  for (const a of roundAttempts) {
    try {
      const r = await axios.get(`https://${RAPIDAPI_HOST}/football-get-all-rounds`, {
        params: { [a.key]: a.val },
        headers: {
          'x-rapidapi-key': RAPIDAPI_KEY,
          'x-rapidapi-host': RAPIDAPI_HOST,
        },
      });
      results[`rounds_${a.key}`] = r.data?.status || r.data;
    } catch (e) {
      results[`rounds_${a.key}`] = e.response?.data || e.message;
    }
  }

  res.json(results);
});
app.listen(PORT, () => console.log(`Sportle backend running on port ${PORT}`));