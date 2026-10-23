/**
 * The Flask API for the end-to-end tests, on its own local database so a test run never touches
 * your development data (and can never touch production: only localhost URLs are accepted).
 *
 *   node scripts/e2e-backend.mjs           create the database if needed, migrate, reseed (destructive)
 *   node scripts/e2e-backend.mjs --serve   the same, then serve the API on E2E_BACKEND_PORT
 *
 * Environment (all optional):
 *   BACKEND_DIR        the Flask repo      default ../../Module_02/module-2-jim1504
 *   E2E_DATABASE_URL   its test database   default postgresql://postgres:postgres@localhost:5432/revoshop_e2e
 *   E2E_BACKEND_PORT   where it listens    default 5055
 *
 * playwright.config.ts starts it with --serve; tests/global-setup.ts reseeds before every run.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BACKEND_DIR = resolve(process.env.BACKEND_DIR ?? join(ROOT, "..", "..", "Module_02", "module-2-jim1504"));
const DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/revoshop_e2e";
const PORT = process.env.E2E_BACKEND_PORT ?? "5055";

const db = new URL(DATABASE_URL);
if (!["localhost", "127.0.0.1"].includes(db.hostname)) {
  console.error(`e2e-backend: refusing ${db.hostname} - the end-to-end database is wiped and reseeded, so it must be local.`);
  process.exit(1);
}
if (!existsSync(join(BACKEND_DIR, "app.py"))) {
  console.error(`e2e-backend: no Flask app at ${BACKEND_DIR} - set BACKEND_DIR to the Module 2 repo.`);
  process.exit(1);
}

const venv = ["venv/Scripts/python.exe", "venv/bin/python", ".venv/Scripts/python.exe", ".venv/bin/python"]
  .map((p) => join(BACKEND_DIR, p))
  .find(existsSync);
const python = venv ?? "python";
const env = { ...process.env, DATABASE_URL, FLASK_DEBUG: "0" };

function run(args, label) {
  const result = spawnSync(python, args, { cwd: BACKEND_DIR, env, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
  if (result.status !== 0) {
    console.error(`e2e-backend: ${label} failed\n${result.stdout}\n${result.stderr}`);
    process.exit(1);
  }
  return result.stdout;
}

// 1. the database itself (psycopg 3 ships with the backend)
run(
  [
    "-c",
    [
      "import sys, psycopg",
      "from psycopg import sql",
      "u = sys.argv[1]",
      "name = u.rsplit('/', 1)[1].split('?')[0]",
      "with psycopg.connect(u.rsplit('/', 1)[0] + '/postgres', autocommit=True) as c:",
      "    if not c.execute('select 1 from pg_database where datname = %s', (name,)).fetchone():",
      "        c.execute(sql.SQL('create database {}').format(sql.Identifier(name)))",
    ].join("\n"),
    DATABASE_URL,
  ],
  "create database"
);
// 2. schema, 3. data
run(["-m", "flask", "db", "upgrade"], "flask db upgrade");
process.stdout.write(run(["seed_db.py"], "seed_db.py"));

if (process.argv.includes("--serve")) {
  const waitress = [venv && join(dirname(venv), process.platform === "win32" ? "waitress-serve.exe" : "waitress-serve")].find(
    (p) => p && existsSync(p)
  );
  const [cmd, args] = waitress ? [waitress, []] : [python, ["-m", "waitress"]];
  console.log(`e2e-backend: serving ${BACKEND_DIR} on http://localhost:${PORT} (${db.pathname.slice(1)})`);
  const server = spawn(cmd, [...args, `--port=${PORT}`, "--threads=8", "app:app"], { cwd: BACKEND_DIR, env, stdio: "inherit" });
  const stop = () => server.kill();
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  server.on("exit", (code) => process.exit(code ?? 0));
}
