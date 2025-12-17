#!/usr/bin/env node
// @ts-check

const { WebClient } = require("@slack/web-api");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, ".env") });

// Capture command-line arguments:
//   process.argv[0] => 'node'
//   process.argv[1] => 'updateSlackStatus.js'
//   process.argv[2] => statusText
//   process.argv[3] => statusEmoji
//   process.argv[4] => statusExpiration (in hours) (0 will not expire)
//   process.argv[5] => doNotDisturb (0 | 1)

const [
  ,
  ,
  statusText = "Away",
  statusEmoji = ":away:",
  statusExpiration = "0", // Hours
  doNotDisturb = "0",
] = process.argv;

// Slack token should be stored securely, here we read from an environment variable
const token = process.env.SLACK_TOKEN;
if (!token) {
  console.error("Error: SLACK_TOKEN environment variable is missing.");
  process.exit(1);
}

// Create a new WebClient instance with your token
const web = new WebClient(token);

(async () => {
  try {
    const expirationTime = parseFloat(statusExpiration) || 0;
    const statusExpirationAdjusted = expirationTime
      ? Math.floor(Date.now() / 1000 + expirationTime * 60 * 60)
      : 0;

    const result = await web.users.profile.set({
      profile: {
        status_text: statusText,
        status_emoji: statusEmoji,
        status_expiration: statusExpirationAdjusted,
      },
    });
    let snoozeMinutes = 0;
    // Calculate the number of minutes until tomorrow
    const now = new Date();
    const tomorrow = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1
    );
    tomorrow.setHours(0, 0, 0, 0);

    const minutesUntilTomorrow = Math.floor(
      (tomorrow.getTime() - now.getTime()) / 60000
    );

    const snooze = await web.dnd.setSnooze({
      num_minutes: parseInt(doNotDisturb)
        ? expirationTime
          ? // Set expiration to end of status
            expirationTime * 60
          : // Set expiration to tomorrow
            minutesUntilTomorrow
        : 0,
      token,
    });

    console.log(`Status updated successfully @ ${new Date().toTimeString()}`);
    console.log(`  Text:  ${result.profile?.status_text || "N/A"}`);
    console.log(`  Emoji: ${result.profile?.status_emoji || "N/A"}`);
    console.log(`  Expiration time: ${result.profile?.status_expiration}`);
    console.log(`  Snooze duration: ${expirationTime * 60}`);
    console.log(`  Snooze enabled: ${snooze?.snooze_enabled}`);
    console.log(`  Snooze endtime: ${snooze?.snooze_endtime}`);
  } catch (error) {
    console.error("Error updating Slack status:", error.message);
    // Log inputs
    console.log(`  Text:  ${statusText}`);
    console.log(`  Emoji: ${statusEmoji}`);
    process.exit(1);
  }
})();
