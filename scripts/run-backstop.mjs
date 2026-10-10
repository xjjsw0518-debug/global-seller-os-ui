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

function waitForViteStartup() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Timed out waiting for Vite to start")),
      30_000,
    );

    const onData = (chunk) => {
      if (chunk.toString().includes("Local:")) {
        clearTimeout(timeout);
        server.stdout.off("data", onData);
        server.off("exit", onExit);
        resolve();
      }
    };
    const onExit = (code) => {
      clearTimeout(timeout);
      server.stdout.off("data", onData);
      reject(new Error(`Vite exited before becoming ready (${code})`));
    };

    server.stdout.on("data", onData);
    server.once("exit", onExit);
  });
}

async function waitForServer() {
  await waitForViteStartup();

  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`Vite exited before becoming ready (${server.exitCode})`);
    }

    try {
      const response = await fetch(baseURL);
      if (response.ok) return;
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
