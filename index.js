require("dotenv").config();
const express = require("express");
const cron = require("node-cron");
const sequelize = require("./db");
const { runLiverpoolJob } = require("./jobs/postJob");
const cacheRoutes = require("./routes/cacheRoutes");

const app = express();

app.use("/api/cache", cacheRoutes);

sequelize
  .authenticate()
  .then(() => {
    console.log("Database connected successfully");
  })
  .catch((err) => {
    console.error("Unable to connect to the database:", err);
  });

const PORT = process.env.PORT || 7000;

app.listen(PORT, async () => {
  console.log(`Server running on ${PORT}`);

  await runLiverpoolJob();

  process.exit(0);
});
