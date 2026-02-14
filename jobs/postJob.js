const {
  getLiverpoolLiveFixtures,
  getMatchEvents,
  getMatchLineup,
  LIVERPOOL_TEAM_ID,
} = require("../services/footballService");
const { postToFacebook } = require("../utils/facebookPoster");
const { isEventPosted, savePostedEvent } = require("../utils/postTracker");

async function runLiverpoolJob() {
  console.log("Running Liverpool FC post job...");

  try {
    const liveMatches = await getLiverpoolLiveFixtures();
    for (const match of liveMatches) {
      await processLiverpoolMatch(match);
    }
  } catch (error) {
    console.error("Error in Liverpool post job:", error);
  }
}

async function processLiverpoolMatch(match) {
  const matchId = match.fixture.id;
  const homeTeam = match.teams.home.name;
  const awayTeam = match.teams.away.name;
  const isHome = match.teams.home.id === LIVERPOOL_TEAM_ID;
  const liverpoolTeam = isHome ? match.teams.home : match.teams.away;
  const opponentTeam = isHome ? match.teams.away : match.teams.home;

  console.log(`Processing Liverpool match: ${homeTeam} vs ${awayTeam}`);

  if (
    match.fixture.status.short === "1H" ||
    match.fixture.status.short === "2H"
  ) {
    await checkStartingXI(match);
  }

  if (
    match.fixture.status.short === "1H" &&
    match.fixture.status.elapsed <= 5
  ) {
    await checkKickOff(match);
  }

  if (match.fixture.status.short === "HT") {
    await checkHalfTime(match);
  }

  await checkGoals(match);

  await checkRedCards(match);

  if (
    match.fixture.status.short === "FT" ||
    match.fixture.status.short === "AET"
  ) {
    await checkMatchEnd(match);
  }
}

async function checkStartingXI(match) {
  const matchId = match.fixture.id;
  const eventType = "starting_xi";

  if (await isEventPosted(matchId, eventType)) {
    return;
  }

  try {
    const lineups = await getMatchLineup(matchId);
    const liverpoolLineup = lineups.find(
      (lineup) => lineup.team.id === LIVERPOOL_TEAM_ID,
    );

    if (liverpoolLineup && liverpoolLineup.startXI.length > 0) {
      const players = liverpoolLineup.startXI
        .map((player) => `${player.player.name} (${player.player.number})`)
        .join("\n");

      const message = `🔴 LIVERPOOL FC STARTING XI 🔴\n\n${players}`;

      const result = await postToFacebook(message);
      if (result && result.id) {
        await savePostedEvent(matchId, eventType, {
          lineup: liverpoolLineup.startXI,
        });
      }
    }
  } catch (error) {
    console.error("Error checking starting XI:", error);
  }
}

async function checkKickOff(match) {
  const matchId = match.fixture.id;
  const eventType = "kick_off";

  if (await isEventPosted(matchId, eventType)) {
    return;
  }

  const homeTeam = match.teams.home.name;
  const awayTeam = match.teams.away.name;
  const message = `⚽ KICK OFF! ⚽\n\n🔴 ${homeTeam} vs ${awayTeam} 🔴\n\nMatch has begun!`;

  const result = await postToFacebook(message);
  if (result && result.id) {
    await savePostedEvent(matchId, eventType);
  }
}

async function checkHalfTime(match) {
  const matchId = match.fixture.id;
  const eventType = "half_time";

  if (await isEventPosted(matchId, eventType)) {
    return;
  }

  const homeTeam = match.teams.home.name;
  const awayTeam = match.teams.away.name;
  const homeScore = match.goals.home || 0;
  const awayScore = match.goals.away || 0;

  const message = `⏸️ HALF TIME ⏸️\n\n🔴 ${homeTeam} ${homeScore} - ${awayScore} ${awayTeam} 🔴\n\nLiverpool FC halftime score!`;

  const result = await postToFacebook(message);
  if (result && result.id) {
    await savePostedEvent(matchId, eventType, {
      homeScore,
      awayScore,
    });
  }
}

async function checkGoals(match) {
  const matchId = match.fixture.id;
  const eventType = "goal";

  try {
    const events = await getMatchEvents(matchId);
    const goalEvents = events.filter(
      (event) =>
        event.type === "Goal" &&
        (event.team.id === LIVERPOOL_TEAM_ID ||
          (event.detail === "Own Goal" && event.team.id !== LIVERPOOL_TEAM_ID)),
    );

    for (const goalEvent of goalEvents) {
      const goalEventId = `${matchId}-goal-${goalEvent.time.elapsed}-${goalEvent.player.id}`;

      if (await isEventPosted(matchId, goalEventId)) {
        continue;
      }

      const isLiverpoolGoal = goalEvent.team.id === LIVERPOOL_TEAM_ID;
      const isOwnGoal = goalEvent.detail === "Own Goal";
      const emoji = isLiverpoolGoal ? "🥅" : "❌";
      const action = isOwnGoal
        ? "concedes"
        : isLiverpoolGoal
          ? "SCORES!"
          : "concedes";

      const message = `${emoji} ${
        goalEvent.player.name
      } ${action}!\n\n🔴 Liverpool FC ${match.goals.home || 0} - ${
        match.goals.away || 0
      } ${match.teams.away.name} 🔴\n\n${goalEvent.time.elapsed}'`;

      const result = await postToFacebook(message);
      if (result && result.id) {
        await savePostedEvent(matchId, goalEventId, goalEvent);
      }
    }
  } catch (error) {
    console.error("Error checking goals:", error);
  }
}

async function checkRedCards(match) {
  const matchId = match.fixture.id;

  try {
    const events = await getMatchEvents(matchId);
    const redCardEvents = events.filter(
      (event) => event.type === "Card" && event.detail === "Red Card",
    );

    for (const cardEvent of redCardEvents) {
      const cardEventId = `${matchId}-redcard-${cardEvent.time.elapsed}-${cardEvent.player.id}`;

      if (await isEventPosted(matchId, cardEventId)) {
        continue;
      }

      const isLiverpoolPlayer = cardEvent.team.id === LIVERPOOL_TEAM_ID;
      const teamName = isLiverpoolPlayer ? "Liverpool FC" : cardEvent.team.name;
      const emoji = isLiverpoolPlayer ? "🔴❌" : "🔴⚽";

      const message = `${emoji} RED CARD! ${emoji}\n\n${cardEvent.player.name} (${teamName}) sent off!\n\n${cardEvent.time.elapsed}'`;

      const result = await postToFacebook(message);
      if (result && result.id) {
        await savePostedEvent(matchId, cardEventId, cardEvent);
      }
    }
  } catch (error) {
    console.error("Error checking red cards:", error);
  }
}

async function checkMatchEnd(match) {
  const matchId = match.fixture.id;
  const eventType = "match_end";

  if (await isEventPosted(matchId, eventType)) {
    return;
  }

  const homeTeam = match.teams.home.name;
  const awayTeam = match.teams.away.name;
  const homeScore = match.goals.home || 0;
  const awayScore = match.goals.away || 0;
  const isHome = match.teams.home.id === LIVERPOOL_TEAM_ID;
  const liverpoolScore = isHome ? homeScore : awayScore;
  const opponentScore = isHome ? awayScore : homeScore;
  const opponentName = isHome ? awayTeam : homeTeam;

  let result = "";
  if (liverpoolScore > opponentScore) {
    result = "🏆 LIVERPOOL WIN! 🏆";
  } else if (liverpoolScore < opponentScore) {
    result = "😞 Liverpool Defeat 😞";
  } else {
    result = "🤝 Draw 🤝";
  }

  const message = `🏁 FULL TIME 🏁\n\n${result}\n\n🔴 Liverpool FC ${liverpoolScore} - ${opponentScore} ${opponentName} 🔴\n\nMatch finished!`;

  const fbResult = await postToFacebook(message);
  if (fbResult && fbResult.id) {
    await savePostedEvent(matchId, eventType, {
      homeScore,
      awayScore,
      result: result.replace(/[🏆😞🤝]/g, "").trim(),
    });
  }
}

module.exports = {
  runLiverpoolJob,
};
