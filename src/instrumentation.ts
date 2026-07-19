// instrumentation.ts — runs once on Next.js server startup.
// Spawns the sofia-bot mini-service as a child process so it stays alive
// as long as the Next.js dev server is running (the sandbox kills detached
// background processes, so we anchor the bot to the long-lived Next.js process).

export async function register(): Promise<void> {
  // Only run on the server (not during build).
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (typeof window !== "undefined") return;

  const path = await import("node:path");
  const fs = await import("node:fs");

  const botDir = path.resolve(process.cwd(), "mini-services/sofia-bot");
  if (!fs.existsSync(botDir)) {
    console.warn("[instrumentation] sofia-bot dir not found, skipping spawn");
    return;
  }

  // Avoid double-spawn in dev (Next.js can call register twice).
  const marker = path.resolve(process.cwd(), ".sofia-bot-spawned");
  if (fs.existsSync(marker)) {
    return;
  }
  try {
    fs.writeFileSync(marker, String(process.pid));
  } catch {
    /* ignore */
  }

  const { spawn } = await import("node:child_process");
  const logPath = path.resolve(process.cwd(), "sofia-bot.log");

  const child = spawn("bun", ["src/index.ts"], {
    cwd: botDir,
    env: { ...process.env, FORCE_COLOR: "0" },
    stdio: ["ignore", "ignore", "ignore"],
    detached: false,
  });

  child.on("exit", (code, signal) => {
    console.warn(`[instrumentation] sofia-bot exited code=${code} signal=${signal}; respawning in 3s`);
    setTimeout(() => {
      try {
        fs.unlinkSync(marker);
      } catch {
        /* ignore */
      }
      register().catch(() => {});
    }, 3000);
  });

  console.log(`[instrumentation] sofia-bot spawned (PID ${child.pid}) -> log: ${logPath}`);
}
