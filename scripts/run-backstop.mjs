import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import backstop from "backstopjs";

const command = process.argv[2];
const supportedCommands = new Set(["reference", "test"]);

if (!supportedCommands.has(command)) {
  throw new Error(`Expected one of: ${[...supportedCommands].join(", ")}`);
}

const host = "127.0.0.1";
const port = "4173";
const baseURL = `http://${host}:${port}`;
const viteCli = fileURLToPath(
  new URL("../node_modules/vite/bin/vite.js", import.meta.url),
);
const server = spawn(
  process.execPath,
  [viteCli, "--host", host, "--port", port, "--strictPort"],
  {
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  },
);

server.stdout.pipe(process.stdout);
server.stderr.pipe(process.stderr);

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`Vite exited before becoming ready (${server.exitCode})`);
    }

    try {
      const response = await fetch(baseURL);
      if (response.ok) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        if (server.exitCode === null) return;
      }
    } catch {
      // Vite is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for ${baseURL}`);
}

try {
  await waitForServer();
  await backstop(command, {
    config: "backstop.config.cjs",
  });
} finally {
  if (server.exitCode === null) {
    server.kill("SIGTERM");
  }
}
