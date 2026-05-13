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

app.get('/', (req, res) => {
  res.json({
    app: 'Sportle',
    status: 'running',
    endpoints: ['/fixtures', '/standings', '/live']
  });
});

// Live scores
app.get('/live', async (req, res) => {
  try {
    const data = await fetchWithCache(
      `https://${RAPIDAPI_HOST}/football-current-live`,
      {},
      30
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch live scores', detail: err.message });
  }
});

// Fixtures for World Cup (all matches)
app.get('/fixtures', async (req, res) => {
  try {
    const data = await fetchWithCache(
      `https://${RAPIDAPI_HOST}/football-get-all-matches-by-league`,
      { leagueId : WORLD_CUP_ID },
      3600
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch fixtures', detail: err.message });
  }
});

// Fixtures by date (bonus — useful for daily schedule screen)
app.get('/fixtures/today', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const data = await fetchWithCache(
      `https://${RAPIDAPI_HOST}/football-get-matches-by-date`,
      { date: today },
      300
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch today fixtures', detail: err.message });
  }
});

// Standings
app.get('/standings', async (req, res) => {
  try {
    const data = await fetchWithCache(
      `https://${RAPIDAPI_HOST}/football-get-standing-all`,
      { leagueid: WORLD_CUP_ID },
      900
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch standings', detail: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Sportle backend running on port ${PORT}`));