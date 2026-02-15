// external
const axios = require("axios");

// internal
const { fbToken, pageId } = require("../config/configs");

async function postToFacebook(message) {
  try {
    const res = await axios.post(
      `https://graph.facebook.com/v20.0/${pageId}/feed`,
      {
        message,
        access_token: fbToken,
      },
    );

    console.log("FB Post successful:", res.data);
    return res.data;
  } catch (err) {
    console.error("FB Post failed:", err.response?.data || err.message);
    return null;
  }
}

module.exports = { postToFacebook };
