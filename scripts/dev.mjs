import { spawn } from "node:child_process";
import process from "node:process";

const backend = spawn("python3", ["-m", "uvicorn", "server.app.main:app", "--host", "127.0.0.1", "--port", "8000", "--reload"], {
  stdio: "inherit",
  env: { ...process.env }
});

const frontend = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", "5173"], {
  cwd: "interface",
  stdio: "inherit",
  env: { ...process.env }
});

const shutdown = () => {
  for (const child of [backend, frontend]) {
    if (!child.killed) child.kill("SIGTERM");
  }
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

backend.on("exit", (code) => {
  if (code !== null) {
    frontend.kill("SIGTERM");
    process.exit(code ?? 0);
  }
});

frontend.on("exit", (code) => {
  if (code !== null) {
    backend.kill("SIGTERM");
    process.exit(code ?? 0);
  }
});
