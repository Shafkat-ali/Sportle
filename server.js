require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { Redis } = require('@upstash/redis');

const app = express();

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'free-api-live-football-data.p.rapidapi.com';
const WORLD_CUP_ID = 77;
const BASE = `https://${RAPIDAPI_HOST}`;

async function fetchWithCache(url, params, ttlSeconds) {
  const cacheKey = 'sportle:' + url + JSON.stringify(params);

  const cached = await redis.get(cacheKey);
  if (cached) {
    console.log('CACHE HIT:', cacheKey);
    return cached;
  }

  console.log('CACHE MISS:', url);
  const response = await axios.get(url, {
    params,
    headers: {
      'x-rapidapi-key': RAPIDAPI_KEY,
      'x-rapidapi-host': RAPIDAPI_HOST,
    },
  });

  await redis.set(cacheKey, response.data, { ex: ttlSeconds });
  return response.data;
}

// ── Root ──────────────────────────────────────────────────────────────
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
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    const today = `${year}${month}${day}`;
    
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
    const leagueId = req.query.leagueId || WORLD_CUP_ID;
    const data = await fetchWithCache(
      `${BASE}/football-get-list-all-team`,
      { leagueid: leagueId },
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
// Fixtures by league
app.get('/fixtures/league/:leagueId', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const data = await fetchWithCache(
      `${BASE}/football-get-matches-by-date-and-league`,
      { date: today, leagueId: req.params.leagueId },
      300
    );

    // API returns array of league objects each with matches array
    // Find the matching league and extract its matches
    const leagueId = parseInt(req.params.leagueId);
    let matches = [];

    if (Array.isArray(data.response)) {
      const league = data.response.find(l => l.id === leagueId);
      if (league && Array.isArray(league.matches)) {
        matches = league.matches;
      }
    } else if (data.response?.matches) {
      matches = data.response.matches;
    }

    res.json({ status: 'success', response: { matches } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch league fixtures', detail: err.message });
  }
});
app.listen(PORT, () => console.log(`Sportle backend running on port ${PORT}`));