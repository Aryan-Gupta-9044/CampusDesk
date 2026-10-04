// Jest 27's node environment doesn't expose Node's built-in fetch to tests.
// This tiny environment copies it over so supabase-js can make real HTTP calls.
const NodeEnvironment = require("jest-environment-node");

class NodeEnvWithFetch extends (NodeEnvironment.TestEnvironment || NodeEnvironment) {
  constructor(...args) {
    super(...args);
    ["fetch", "WebSocket", "Headers", "Request", "Response", "AbortController", "AbortSignal", "FormData", "Blob", "TextEncoder", "TextDecoder", "URL", "URLSearchParams"].forEach((k) => {
      if (globalThis[k] && !this.global[k]) this.global[k] = globalThis[k];
    });
  }
}

module.exports = NodeEnvWithFetch;
