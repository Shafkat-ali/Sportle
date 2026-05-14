require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { Redis } = require('@upstash/redis');
const { createClient } = require('@supabase/supabase-js');

const app = express();

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'free-api-live-football-data.p.rapidapi.com';
const WORLD_CUP_ID = 77;
const BASE = `https://${RAPIDAPI_HOST}`;

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

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

// ─── Push Notifications ────────────────────────────────────────────────────

async function generateEmotionalMessage(eventType, homeName, awayName, homeScore, awayScore, minute) {
  const prompts = {
    kickoff: `Write a short, exciting push notification (max 12 words) for a soccer match starting now: ${homeName} vs ${awayName}. Make it feel like a big event is beginning. No emojis.`,
    goal: `Write a short, emotional push notification (max 12 words) for a goal in minute ${minute}: ${homeName} ${homeScore}-${awayScore} ${awayName}. Make it dramatic. No emojis.`,
    halftime: `Write a short push notification (max 12 words) for halftime: ${homeName} ${homeScore}-${awayScore} ${awayName}. Capture the tension. No emojis.`,
    fulltime: `Write a short, emotional push notification (max 12 words) for full time: ${homeName} ${homeScore}-${awayScore} ${awayName}. Make it feel significant. No emojis.`,
  };

  try {
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 60,
      messages: [{ role: 'user', content: prompts[eventType] }],
    }, {
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
    });
    return response.data.content[0].text.trim();
  } catch (e) {
    const fallbacks = {
      kickoff: `${homeName} vs ${awayName} has kicked off`,
      goal: `Goal! ${homeName} ${homeScore} - ${awayScore} ${awayName}`,
      halftime: `Half time: ${homeName} ${homeScore} - ${awayScore} ${awayName}`,
      fulltime: `Full time: ${homeName} ${homeScore} - ${awayScore} ${awayName}`,
    };
    return fallbacks[eventType];
  }
}

async function sendPushNotification(token, title, body) {
  try {
    await axios.post('https://exp.host/--/api/v2/push/send', {
      to: token,
      sound: 'default',
      title,
      body,
      data: { type: 'match_alert' },
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
  } catch (err) {
    console.error('Push send error:', err.message);
  }
}

const notifiedEvents = new Set();

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

    const { data: tokens } = await supabaseAdmin.from('push_tokens').select('user_id, token');
    if (!tokens || tokens.length === 0) return;

    for (const { user_id, token } of tokens) {
      const { data: favs } = await supabaseAdmin
        .from('favorites')
        .select('team_id, team_name')
        .eq('user_id', user_id);

      if (!favs || favs.length === 0) continue;
      const favTeamIds = new Set(favs.map(f => f.team_id));

      for (const match of liveMatches) {
        const homeId = match.home?.id;
        const awayId = match.away?.id;
        if (!favTeamIds.has(homeId) && !favTeamIds.has(awayId)) continue;

        const homeName = match.home?.name || 'Home';
        const awayName = match.away?.name || 'Away';
        const homeScore = match.home?.score ?? 0;
        const awayScore = match.away?.score ?? 0;
        const minute = match.status?.liveTime?.short || '';
        const matchId = match.id;

        // Kickoff
        const kickoffKey = `${matchId}-kickoff`;
        if (!notifiedEvents.has(kickoffKey) && minute === "1'") {
          const body = await generateEmotionalMessage('kickoff', homeName, awayName, homeScore, awayScore, minute);
          await sendPushNotification(token, 'Match starting', body);
          notifiedEvents.add(kickoffKey);
        }

        // Goal - detect score change
        const scoreKey = `${matchId}-${homeScore}-${awayScore}`;
        if (!notifiedEvents.has(scoreKey) && (homeScore > 0 || awayScore > 0)) {
          const body = await generateEmotionalMessage('goal', homeName, awayName, homeScore, awayScore, minute);
          await sendPushNotification(token, `${homeName} ${homeScore} - ${awayScore} ${awayName}`, body);
          notifiedEvents.add(scoreKey);
        }

        // Halftime
        const halftimeKey = `${matchId}-halftime`;
        if (!notifiedEvents.has(halftimeKey) && match.status?.halftime === true) {
          const body = await generateEmotionalMessage('halftime', homeName, awayName, homeScore, awayScore, minute);
          await sendPushNotification(token, 'Half time', body);
          notifiedEvents.add(halftimeKey);
        }

        // Full time
        const fulltimeKey = `${matchId}-fulltime`;
        if (!notifiedEvents.has(fulltimeKey) && match.status?.finished === true) {
          const body = await generateEmotionalMessage('fulltime', homeName, awayName, homeScore, awayScore, minute);
          await sendPushNotification(token, 'Full time', body);
          notifiedEvents.add(fulltimeKey);
        }
      }
    }
  } catch (err) {
    console.error('Notification job error:', err.message);
  }
}

setInterval(checkAndNotify, 2 * 60 * 1000);

// ─── Start Server ──────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;

app.get('/scorers', async (req, res) => {
  try {
    const leagueId = req.query.leagueId || WORLD_CUP_ID;
    const data = await fetchWithCache(
      `${BASE}/football-get-top-players-by-league`,
      { leagueid: leagueId },
      3600
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch scorers', detail: err.message });
  }
});
app.listen(PORT, () => console.log(`Sportle backend running on port ${PORT}`));