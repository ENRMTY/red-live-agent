const {
  getLiverpoolLiveFixtures,
  getLiverpoolUpcomingFixtures,
  getMatchEvents,
  getMatchLineup,
  getMatchLineupUncached,
  LIVERPOOL_TEAM_ID,
} = require("../services/footballService");
const { postToFacebook } = require("../utils/facebookPoster");
const { isEventPosted, savePostedEvent } = require("../utils/postTracker");

const PRE_MATCH_LINEUP_WINDOW_MIN = 30;
const PRE_MATCH_LINEUP_WINDOW_MAX = 60;

async function runLiverpoolJob() {
  console.log("Running Liverpool FC post job...");

  try {
    await checkPreMatchLineups();
  } catch (error) {
    console.error("Error in pre-match lineup check:", error);
  }

  try {
    const liveMatches = await getLiverpoolLiveFixtures();
    for (const match of liveMatches) {
      await processLiverpoolMatch(match);
    }
  } catch (error) {
    console.error("Error in Liverpool post job:", error);
  }
}

// post lineups 30–60 minutes before kickoff
async function checkPreMatchLineups() {
  const upcoming = await getLiverpoolUpcomingFixtures();
  const now = new Date();
  const windowStart = new Date(
    now.getTime() + PRE_MATCH_LINEUP_WINDOW_MIN * 60 * 1000,
  );
  const windowEnd = new Date(
    now.getTime() + PRE_MATCH_LINEUP_WINDOW_MAX * 60 * 1000,
  );

  for (const match of upcoming) {
    if (match.fixture.status.short !== "NS") {
      continue;
    }

    const kickoff = new Date(match.fixture.date);
    if (kickoff < windowStart || kickoff > windowEnd) {
      continue;
    }

    const matchId = match.fixture.id;
    const eventType = "pre_match_lineup";
    if (await isEventPosted(matchId, eventType)) {
      continue;
    }

    try {
      const lineups = await getMatchLineupUncached(matchId);
      if (!lineups || lineups.length < 2) {
        continue;
      }

      const homeLineup = lineups.find((l) => l.team.id === match.teams.home.id);
      const awayLineup = lineups.find((l) => l.team.id === match.teams.away.id);
      if (!homeLineup?.startXI?.length || !awayLineup?.startXI?.length) {
        continue;
      }

      const isLiverpoolHome = match.teams.home.id === LIVERPOOL_TEAM_ID;
      const liverpoolLineup = isLiverpoolHome ? homeLineup : awayLineup;
      const opponentLineup = isLiverpoolHome ? awayLineup : homeLineup;
      const liverpoolName =
        match.teams.home.id === LIVERPOOL_TEAM_ID ? homeName : awayName;
      const opponentName =
        match.teams.home.id === LIVERPOOL_TEAM_ID ? awayName : homeName;
      const message = formatLineupMessage(
        liverpoolLineup,
        opponentLineup,
        liverpoolName,
        opponentName,
      );

      const result = await postToFacebook(message);
      if (result && result.id) {
        await savePostedEvent(matchId, eventType, { homeName, awayName });
      }
    } catch (err) {
      console.error("Error posting pre-match lineup for fixture", matchId, err);
    }
  }
}

// format lineups
function formatLineupMessage(homeLineup, awayLineup, homeName, awayName) {
  const lines = [
    `${homeName} vs. ${awayName} line-ups:`,
    "",
    "🔴 " + formatTeamLineup(homeLineup),
    "👕 Subs: " + formatSubs(homeLineup),
    "",
    "🟡 " + formatTeamLineup(awayLineup),
    "👕 Subs: " + formatSubs(awayLineup),
  ];
  return lines.join("\n");
}

function formatTeamLineup(lineup) {
  const startXI = lineup.startXI || [];
  const formation = (lineup.formation || "4-3-3").split("-").map(Number);
  if (formation.length < 2) formation.push(4, 3, 3);
  const counts = [1].concat(formation);
  let i = 0;
  const groups = [];
  for (const count of counts) {
    const slice = startXI.slice(i, i + count);
    i += count;
    const parts = slice.map((x) => {
      const name = x.player?.name ?? x.player ?? "?";
      const num = x.player?.number ?? x.number ?? "";
      const cap =
        x.player?.reason === "Captain" || x.reason === "Captain" ? " (c)" : "";
      return num ? `${name}${cap}` : name + cap;
    });
    groups.push(parts.join(", "));
  }
  return groups.filter(Boolean).join("; ");
}

function formatSubs(lineup) {
  const subs = lineup.substitutes || [];
  return subs.map((s) => s.player?.name ?? s.player ?? "?").join(", ");
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

  if (
    match.fixture.status.short === "2H" &&
    (match.fixture.status.elapsed === 0 || match.fixture.status.elapsed === 1)
  ) {
    await checkSecondHalf(match);
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

function getScoreLine(match) {
  const homeName = match.teams.home.name;
  const awayName = match.teams.away.name;
  const homeScore = match.goals.home ?? 0;
  const awayScore = match.goals.away ?? 0;
  return `${homeName} ${homeScore}-${awayScore} ${awayName}`;
}

function formatMinute(time) {
  if (!time) {
    return "?";
  }
  const min = time.elapsed ?? 0;
  const extra = time.extra;
  return extra ? `${min}+${extra}'` : `${min}'`;
}

async function checkKickOff(match) {
  const matchId = match.fixture.id;
  const eventType = "kick_off";

  if (await isEventPosted(matchId, eventType)) {
    return;
  }

  const scoreLine = `${match.teams.home.name} 0-0 ${match.teams.away.name}`;
  const message = `1' 🔴 | Kick off\n${scoreLine}`;

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

  const scoreLine = getScoreLine(match);
  const message = `Half-time 🔴\n${scoreLine}`;

  const result = await postToFacebook(message);
  if (result && result.id) {
    await savePostedEvent(matchId, eventType, {
      homeScore: match.goals.home || 0,
      awayScore: match.goals.away || 0,
    });
  }
}

async function checkSecondHalf(match) {
  const matchId = match.fixture.id;
  const eventType = "second_half";

  if (await isEventPosted(matchId, eventType)) {
    return;
  }

  const scoreLine = getScoreLine(match);
  const message = `46' 🔴 | Second half begins\n${scoreLine}`;

  const result = await postToFacebook(message);
  if (result && result.id) {
    await savePostedEvent(matchId, eventType);
  }
}

async function checkGoals(match) {
  const matchId = match.fixture.id;

  try {
    const events = await getMatchEvents(matchId);
    const goalEvents = events.filter(
      (event) =>
        event.type === "Goal" &&
        (event.team.id === LIVERPOOL_TEAM_ID ||
          (event.detail === "Own Goal" && event.team.id !== LIVERPOOL_TEAM_ID)),
    );

    for (const goalEvent of goalEvents) {
      const goalEventId = `${matchId}-goal-${goalEvent.time?.elapsed ?? 0}-${goalEvent.player?.id ?? goalEvent.player?.name}`;

      if (await isEventPosted(matchId, goalEventId)) {
        continue;
      }

      const message = formatGoalMessage(goalEvent, match);
      const result = await postToFacebook(message);
      if (result && result.id) {
        await savePostedEvent(matchId, goalEventId, goalEvent);
      }
    }
  } catch (error) {
    console.error("Error checking goals:", error);
  }
}

function formatGoalMessage(goalEvent, match) {
  const isLiverpoolGoal = goalEvent.team.id === LIVERPOOL_TEAM_ID;
  const goalLabel = isLiverpoolGoal ? "GOAL" : "Goal";
  const scorerName = goalEvent.player?.name ?? goalEvent.player ?? "?";
  const isPenalty = goalEvent.detail === "Penalty";
  const scorerText = isPenalty ? `${scorerName} (P)` : scorerName;
  const minute = formatMinute(goalEvent.time);
  const scoreLine = getScoreLine(match);

  const lines = [`${minute} ⚽ | ${goalLabel}: ${scorerText}`];
  const assistName = goalEvent.assist?.name ?? goalEvent.assist;
  if (assistName) {
    lines.push(`Assist: ${assistName}`);
  }
  lines.push(scoreLine);

  return lines.join("\n");
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
