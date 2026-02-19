require("dotenv").config();

module.exports = {
  fbToken: process.env.FB_PAGE_ACCESS_TOKEN,
  pageId: process.env.PAGE_ID,
  footballApiUrl: process.env.FOOTBALL_API_URL,
  footballApiKey: process.env.API_FOOTBALL_API_KEY,
  footballApiHost: process.env.FOOTBALL_API_HOST,
};
