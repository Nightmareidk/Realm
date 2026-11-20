// Settings in app.json, plus one file that stays out of git: Firebase's google-services.json,
// which lets the Android app get phone notifications. EAS builds get it from the
// GOOGLE_SERVICES_JSON file variable; a local build uses a copy next to this file.
const fs = require("node:fs");
const path = require("node:path");
const { withAndroidManifest } = require("expo/config-plugins");

// "orientation": "portrait" makes Android treat a portrait screen as a must-have, so Google
// Play hides the app from devices that can't turn their screen (some Chromebooks, TVs,
// headsets). Realm still opens in portrait everywhere; this only stops Play from filtering.
const OPTIONAL_FEATURES = ["android.hardware.screen.portrait"];

function withOptionalScreenFeatures(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    const features = manifest["uses-feature"] ?? [];
    for (const name of OPTIONAL_FEATURES) {
      const existing = features.find((f) => f.$?.["android:name"] === name);
      if (existing) {
        existing.$["android:required"] = "false";
      } else {
        features.push({ $: { "android:name": name, "android:required": "false" } });
      }
    }
    manifest["uses-feature"] = features;
    return mod;
  });
}

module.exports = ({ config }) => {
  const local = fs.existsSync(path.join(__dirname, "google-services.json"))
    ? "./google-services.json"
    : undefined;
  const file = process.env.GOOGLE_SERVICES_JSON || local;
  return withOptionalScreenFeatures({
    ...config,
    android: { ...config.android, ...(file ? { googleServicesFile: file } : {}) },
  });
};
