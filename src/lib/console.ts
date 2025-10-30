/**
 * This file overrides the default console logging functions to prevent logs
 * from appearing in the browser console. This is useful for cleaning up
 * the console during development or for production builds.
 *
 * To re-enable logs, you can comment out the import of this file
 * in `src/main.tsx`.
 */

// A simple flag to control logging. Set to `false` to disable all logs.
const LOGGING_ENABLED = false;

if (!LOGGING_ENABLED) {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
  console.info = () => {};
  console.debug = () => {};
}