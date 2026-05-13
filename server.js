require('dotenv').config();
const express = require('express');
const axios = require('axios');
const NodeCache = require('node-cache');

const app = express();
const cache = new NodeCache();

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'free-api-live-football-data.p.rapidapi.com';

// Helper: fetch from API-Football with caching
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

// Fixtures endpoint

app.get('/', (req, res) => {
  res.json({ 
    app: 'Sportle',
    status: 'running',
    endpoints: ['/fixtures', '/standings', '/live']
  });
});

app.get('/fixtures', async (req, res) => {
  try {
    const data = await fetchWithCache(
      `https://${RAPIDAPI_HOST}/football-get-all-fixtures-by-league-and-season`,
      { leagueId: 1, season: '2026' },
      3600 // cache 1 hour
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch fixtures' });
  }
});

// Standings endpoint
app.get('/standings', async (req, res) => {
  try {
    const data = await fetchWithCache(
      `https://${RAPIDAPI_HOST}/football-get-standing-by-league-and-season`,
      { leagueId: 1, season: '2026' },
      900 // cache 15 min
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch standings' });
  }
});

// Live scores endpoint
app.get('/live', async (req, res) => {
  try {
    const data = await fetchWithCache(
      `https://${RAPIDAPI_HOST}/football-current-live`,
      {},
      30 // cache 30 seconds
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch live scores' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Sportle backend running on port ${PORT}`));