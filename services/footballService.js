// external
const axios = require("axios");

// internal
const { apiFootballUrl, apiFootballApiKey } = require("../config/configs");
const { cachedRequest } = require("../cache/cacheService");

const LIVERPOOL_TEAM_ID = 40;

async function apiFootballRequest(endpoint, params = {}) {
  const options = {
    method: "GET",
    url: `${apiFootballUrl}/${endpoint}`,
    params,
    headers: {
      "x-apisports-key": apiFootballApiKey,
    },
  };

  const response = await axios.request(options);
  return response.data.response;
}

async function getLiverpoolFixtures(season = new Date().getFullYear()) {
  // cache season fixtures for 1 hour to reduce api calls
  return cachedRequest(
    "liverpool-fixtures",
    () =>
      apiFootballRequest("fixtures", {
        team: LIVERPOOL_TEAM_ID,
        season,
        timezone: "Europe/London",
      }),
    72 * 3600, // 72 hours
  );
}

// live fixtures
async function getLiverpoolLiveFixtures() {
  return cachedRequest(
    "liverpool-live-fixtures",
    () =>
      apiFootballRequest("fixtures", {
        team: LIVERPOOL_TEAM_ID,
        live: "all",
        timezone: "Europe/London",
      }),
    120, // 2 minutes
  );
}

async function getMatchEvents(fixtureId) {
  return cachedRequest(
    `match-events-${fixtureId}`,
    () =>
      apiFootballRequest("fixtures/events", {
        fixture: fixtureId,
      }),
    15, // 15 seconds
  );
}

async function getMatchLineup(fixtureId) {
  return cachedRequest(
    `match-lineup-${fixtureId}`,
    () => apiFootballRequest("fixtures/lineups", { fixture: fixtureId }),
    300, // 5 minutes
  );
}

// match lineups (fresh)
async function getMatchLineupUncached(fixtureId) {
  return apiFootballRequest("fixtures/lineups", { fixture: fixtureId });
}

// upcoming fixtures (next 24h)
async function getLiverpoolUpcomingFixtures() {
  const now = new Date();
  const from = now.toISOString().slice(0, 10);
  const to = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  return cachedRequest(
    "liverpool-upcoming",
    () =>
      apiFootballRequest("fixtures", {
        team: LIVERPOOL_TEAM_ID,
        from,
        to,
        timezone: "Europe/London",
      }),
    18 * 3600, // 18 hours
  );
}

module.exports = {
  getLiverpoolFixtures,
  getLiverpoolLiveFixtures,
  getLiverpoolUpcomingFixtures,
  getMatchEvents,
  getMatchLineup,
  getMatchLineupUncached,
  LIVERPOOL_TEAM_ID,
};
