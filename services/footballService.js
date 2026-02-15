// external
const axios = require("axios");

// internal
const {
  footballApiUrl,
  footballApiKey,
  footballApiHost,
} = require("../config/configs");
const { cachedRequest } = require("../cache/cacheService");

const LIVERPOOL_TEAM_ID = 40;

async function getLiverpoolFixtures() {
  return cachedRequest(
    "liverpool-fixtures",
    async () => {
      const options = {
        method: "GET",
        url: `${footballApiUrl}/fixtures`,
        params: {
          team: LIVERPOOL_TEAM_ID,
          season: new Date().getFullYear(),
          timezone: "Europe/London",
        },
        headers: {
          "x-rapidapi-key": footballApiKey,
          "x-rapidapi-host": footballApiHost,
        },
      };

      const response = await axios.request(options);
      return response.data.response;
    },
    60,
  );
}

async function getLiverpoolLiveFixtures() {
  return cachedRequest(
    "liverpool-live-fixtures",
    async () => {
      const options = {
        method: "GET",
        url: `${footballApiUrl}/fixtures`,
        params: {
          team: LIVERPOOL_TEAM_ID,
          live: "all",
          timezone: "Europe/London",
        },
        headers: {
          "x-rapidapi-key": footballApiKey,
          "x-rapidapi-host": footballApiHost,
        },
      };

      const response = await axios.request(options);
      return response.data.response;
    },
    30,
  );
}

async function getMatchEvents(fixtureId) {
  return cachedRequest(
    `match-events-${fixtureId}`,
    async () => {
      const options = {
        method: "GET",
        url: `${footballApiUrl}/fixtures/events`,
        params: { fixture: fixtureId },
        headers: {
          "x-rapidapi-key": footballApiKey,
          "x-rapidapi-host": footballApiHost,
        },
      };

      const response = await axios.request(options);
      return response.data.response;
    },
    15,
  );
}

async function getMatchLineup(fixtureId) {
  return cachedRequest(
    `match-lineup-${fixtureId}`,
    async () => {
      const response = await requestLineups(fixtureId);
      return response;
    },
    300,
  );
}

/** Fetch lineups without cache (for pre-match posting when we need fresh data) */
async function getMatchLineupUncached(fixtureId) {
  return requestLineups(fixtureId);
}

async function requestLineups(fixtureId) {
  const options = {
    method: "GET",
    url: `${footballApiUrl}/fixtures/lineups`,
    params: { fixture: fixtureId },
    headers: {
      "x-rapidapi-key": footballApiKey,
      "x-rapidapi-host": footballApiHost,
    },
  };
  const response = await axios.request(options);
  return response.data.response;
}

// get liverpool fixtures that kick off in the next 2 hours (for pre-match lineup window)
async function getLiverpoolUpcomingFixtures() {
  const now = new Date();
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  const to = new Date(now);
  to.setDate(to.getDate() + 1);

  return cachedRequest(
    "liverpool-upcoming",
    async () => {
      const options = {
        method: "GET",
        url: `${footballApiUrl}/fixtures`,
        params: {
          team: LIVERPOOL_TEAM_ID,
          from: from.toISOString().slice(0, 10),
          to: to.toISOString().slice(0, 10),
          timezone: "Europe/London",
        },
        headers: {
          "x-rapidapi-key": footballApiKey,
          "x-rapidapi-host": footballApiHost,
        },
      };

      const response = await axios.request(options);
      return response.data.response || [];
    },
    5,
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
