const axios = require("axios");
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
    },
    300,
  );
}

module.exports = {
  getLiverpoolFixtures,
  getLiverpoolLiveFixtures,
  getMatchEvents,
  getMatchLineup,
  LIVERPOOL_TEAM_ID,
};
