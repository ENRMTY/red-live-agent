require("dotenv").config();

const sequelize = require("./db");
const { runLiverpoolJob } = require("./jobs/postJob");
const {
  getLiverpoolLiveFixtures,
  getLiverpoolUpcomingFixtures,
} = require("./services/footballService");

function isWithinMatchWindow(match, now) {
  const kickoff = new Date(match.fixture.date);
  const PRE_MINUTES = 30;
  const POST_MINUTES = 180;

  const windowStart = new Date(kickoff.getTime() - PRE_MINUTES * 60 * 1000);
  const windowEnd = new Date(kickoff.getTime() + POST_MINUTES * 60 * 1000);

  return now >= windowStart && now <= windowEnd;
}

async function start() {
  try {
    await sequelize.authenticate();
    console.log("Database connected");
    console.log("Liverpool worker started");

    let isRunning = false;

    const loop = async () => {
      if (isRunning) {
        return;
      }

      try {
        isRunning = true;

        const now = new Date();

        const upcoming = await getLiverpoolUpcomingFixtures();
        const matchWindowFixtures = Array.isArray(upcoming)
          ? upcoming.filter((m) => isWithinMatchWindow(m, now))
          : [];

        let liveMatches = [];

        if (matchWindowFixtures.length > 0) {
          liveMatches = await getLiverpoolLiveFixtures();
        }

        let intervalMs = 15 * 60 * 1000;

        if (matchWindowFixtures.length > 0) {
          intervalMs = 5 * 60 * 1000;

          if (liveMatches.length > 0) {
            const liveInPlay = liveMatches.some((m) =>
              ["1H", "2H"].includes(m.fixture.status.short),
            );

            if (liveInPlay) {
              intervalMs = 2 * 60 * 1000;
            }
          }
        }

        await runLiverpoolJob(liveMatches);

        setTimeout(loop, intervalMs);
      } catch (err) {
        console.error("Job error:", err);
        setTimeout(loop, 2 * 60 * 1000);
      } finally {
        isRunning = false;
      }
    };

    loop();
  } catch (err) {
    console.error("Fatal startup error:", err);
    process.exit(1);
  }
}

start();
