// Settings in app.json, plus one file that stays out of git: Firebase's google-services.json,
// which lets the Android app get phone notifications. EAS builds get it from the
// GOOGLE_SERVICES_JSON file variable; a local build uses a copy next to this file.
const fs = require("node:fs");
const path = require("node:path");

module.exports = ({ config }) => {
  const local = fs.existsSync(path.join(__dirname, "google-services.json"))
    ? "./google-services.json"
    : undefined;
  const file = process.env.GOOGLE_SERVICES_JSON || local;
  return {
    ...config,
    android: { ...config.android, ...(file ? { googleServicesFile: file } : {}) },
  };
};
