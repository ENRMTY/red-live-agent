require("dotenv").config();

const sequelize = require("./db");
const { runLiverpoolJob, getLiverpoolLiveFixtures } = require("./jobs/postJob");

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

        const liveMatches = await getLiverpoolLiveFixtures();

        let intervalMs = 2 * 60 * 1000;
        if (liveMatches.length > 0) {
          const liveInPlay = liveMatches.some((m) =>
            ["1H", "2H"].includes(m.fixture.status.short),
          );

          if (liveInPlay) {
            intervalMs = 30 * 1000;
          } else {
            intervalMs = 5 * 60 * 1000;
          }
        }

        await runLiverpoolJob();

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
