require('dotenv').config();
const https = require('https');
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

// Root
app.get('/', (req, res) => {
  res.json({
    app: 'Sportle',
    status: 'running',
    endpoints: [
      '/live', '/fixtures', '/fixtures/today',
      '/fixtures/league/:leagueId', '/standings',
      '/teams', '/teams/:teamId', '/teams/:teamId/players',
      '/players/:playerId', '/matches/:matchId',
      '/matches/:matchId/stats', '/matches/:matchId/lineups', '/rounds',
    ]
  });
});

// Live scores
app.get('/live', async (req, res) => {
  try {
    const data = await fetchWithCache(`${BASE}/football-current-live`, {}, 30);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch live scores', detail: err.message });
  }
});

// Fixtures - World Cup
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

// Fixtures - today all leagues
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

// Fixtures - by league with fallback
app.get('/fixtures/league/:leagueId', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const leagueId = parseInt(req.params.leagueId);

    const leagueData = await fetchWithCache(
      `${BASE}/football-get-matches-by-date-and-league`,
      { date: today, leagueId: leagueId },
      300
    );

    let matches = [];

    if (Array.isArray(leagueData.response)) {
      const league = leagueData.response.find(l => l.id === leagueId);
      if (league && Array.isArray(league.matches)) {
        matches = league.matches;
      }
    }

    if (matches.length === 0) {
      const allData = await fetchWithCache(
        `${BASE}/football-get-matches-by-date`,
        { date: today },
        300
      );
      const all = allData.response?.matches || [];
      matches = all.filter(m => m.leagueId === leagueId);
    }

    res.json({ status: 'success', response: { matches } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch league fixtures', detail: err.message });
  }
});

// Standings
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

// Teams
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

// Players
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

// Match detail
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

// Match stats
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

// Match lineups
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

// Rounds
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
app.listen(PORT, () => console.log(`Sportle backend running on port ${PORT}`));

// Send push notification via Expo
async function sendPushNotification(token, title, body) {
  const message = {
    to: token,
    sound: 'default',
    title,
    body,
    data: { type: 'match_alert' },
  };

  await axios.post('https://exp.host/--/api/v2/push/send', message, {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip, deflate',
    },
  });
}

// Check live matches and notify users with favorite teams
async function checkAndNotify() {
  try {
    const liveData = await axios.get(`https://${RAPIDAPI_HOST}/football-current-live`, {
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': RAPIDAPI_HOST,
      },
    });

    const liveMatches = liveData.data?.response?.live || [];
    if (liveMatches.length === 0) return;

    // Get all favorites and push tokens from Supabase
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const { data: tokens } = await supabase.from('push_tokens').select('user_id, token');
    if (!tokens || tokens.length === 0) return;

    for (const { user_id, token } of tokens) {
      const { data: favs } = await supabase
        .from('favorites')
        .select('team_id, team_name')
        .eq('user_id', user_id);

      if (!favs || favs.length === 0) continue;

      const favTeamIds = new Set(favs.map(f => f.team_id));

      for (const match of liveMatches) {
        const homeId = match.home?.id;
        const awayId = match.away?.id;
        const homeName = match.home?.name;
        const awayName = match.away?.name;
        const homeScore = match.home?.score ?? 0;
        const awayScore = match.away?.score ?? 0;
        const minute = match.status?.liveTime?.short || 'Live';

        if (favTeamIds.has(homeId) || favTeamIds.has(awayId)) {
          const isKickoff = match.status?.liveTime?.long === '1:00' || minute === "1'";
          
          if (isKickoff) {
            await sendPushNotification(
              token,
              'Match started!',
              `${homeName} vs ${awayName} has kicked off`
            );
          } else {
            await sendPushNotification(
              token,
              `${homeName} ${homeScore} - ${awayScore} ${awayName}`,
              `${minute} — Live update`
            );
          }
        }
      }
    }
  } catch (err) {
    console.error('Notification job error:', err.message);
  }
}

// Run every 2 minutes
setInterval(checkAndNotify, 2 * 60 * 1000);