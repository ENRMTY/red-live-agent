// external
require("dotenv").config();
const express = require("express");
const cron = require("node-cron");

// internal
const sequelize = require("./db");
const { runLiverpoolJob } = require("./jobs/postJob");
const cacheRoutes = require("./routes/cacheRoutes");

const app = express();
const PORT = process.env.PORT || 7000;

app.use("/api/cache", cacheRoutes);

async function start() {
  try {
    await sequelize.authenticate();
    console.log("Database connected successfully");
  } catch (err) {
    console.error("Unable to connect to the database:", err);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Server running on ${PORT}`);
  });

  // run post job every 1 minutes
  cron.schedule("*/1 * * * *", async () => {
    await runLiverpoolJob();
  });

  await runLiverpoolJob();
}

start();
