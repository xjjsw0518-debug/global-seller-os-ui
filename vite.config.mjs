import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const aiStagingProxy = () => ({
  target: "http://127.0.0.1:18766",
  changeOrigin: true,
  configure: (proxy) => proxy.on("proxyReq", (proxyReq) => proxyReq.setHeader("origin", "http://127.0.0.1:18766")),
});

const workerStagingProxy = () => ({
  target: "http://127.0.0.1:18765",
  changeOrigin: true,
  rewrite: (path) => path.replace(/^\/__worker_staging/, ""),
  configure: (proxy) => {
    proxy.on("proxyReq", (proxyReq, request) => {
      proxyReq.setHeader("origin", "http://127.0.0.1:18765");
      const workerCookie = String(request.headers.cookie || "")
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith("worker_gso_session="));
      if (workerCookie) {
        proxyReq.setHeader("cookie", `gso_session=${workerCookie.slice("worker_gso_session=".length)}`);
      } else {
        proxyReq.removeHeader("cookie");
      }
    });
    proxy.on("proxyRes", (response) => {
      const setCookies = response.headers["set-cookie"];
      if (!setCookies) return;
      response.headers["set-cookie"] = (Array.isArray(setCookies) ? setCookies : [setCookies]).map((cookie) =>
        cookie
          .replace(/^gso_session=/i, "worker_gso_session=")
          .replace(/;\s*path=\/(?=;|$)/i, "; Path=/__worker_staging"),
      );
    });
  },
});

export default defineConfig({
  build: {
    outDir: "dist/client",
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
    proxy: {
      "/__worker_staging": workerStagingProxy(),
      "/api/v1/ai-providers": aiStagingProxy(),
      "/api/v1/ai-model-configurations": aiStagingProxy(),
      "/api/v1/ai-model-connection-tests": aiStagingProxy(),
      "/api/v1/ai-model-operations": aiStagingProxy(),
      "/api/v1/ai-usage-cost": aiStagingProxy(),
    },
  },
  plugins: [react()],
});
