const { spawnSync } = require("node:child_process");
const path = require("node:path");

const config = path.resolve(__dirname, "../prisma.config.ts");
const maxAttempts = 5;

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  const result = spawnSync(
    "npx",
    ["prisma", "migrate", "deploy", "--config", config],
    { encoding: "utf8", env: process.env },
  );

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) console.error(result.error);

  if (result.status === 0) {
    process.exit(0);
  }

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}${result.error ?? ""}`;
  const retryable = /P1002|advisory lock/i.test(output);
  if (!retryable || attempt === maxAttempts) {
    process.exit(result.status ?? 1);
  }

  const delayMs = 5000 * attempt;
  console.error(
    `prisma migrate deploy failed (attempt ${attempt}/${maxAttempts}); retrying in ${delayMs}ms`,
  );
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs);
}
