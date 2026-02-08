// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://c4101afb170a36b08fd470a8b19e0c76@o4510839345905664.ingest.us.sentry.io/4510839352328197",

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 0.2,

  // Define how likely Replay events are sampled.
  // This sets the sample rate to be 0% during a normal session and 100% when an error occurs.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // You can remove this option if you're not planning to use the Sentry Session Replay feature:
  integrations: [
    Sentry.replayIntegration(),
  ],
});
