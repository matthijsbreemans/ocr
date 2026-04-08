/**
 * Generates prisma/schema.prisma from prisma/schema.template.prisma
 * and runs `prisma generate` + `prisma db push` to auto-migrate.
 *
 * Provider detection:
 *   - DATABASE_URL starts with "file:" -> sqlite
 *   - Otherwise -> postgresql
 *
 * Usage:
 *   node scripts/prisma-provider.mjs           # full setup (generate + db push)
 *   node scripts/prisma-provider.mjs --no-push # generate only (for Docker build)
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const templatePath = resolve(projectRoot, "prisma", "schema.template.prisma");
const outputPath = resolve(projectRoot, "prisma", "schema.prisma");

// Load DATABASE_URL from .env if not already in environment
if (!process.env.DATABASE_URL) {
  try {
    const envPath = resolve(projectRoot, ".env");
    const envContent = readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const match = line.match(/^\s*DATABASE_URL\s*=\s*"?([^"#\n]+)"?\s*/);
      if (match) {
        process.env.DATABASE_URL = match[1].trim();
        break;
      }
    }
  } catch {
    // No .env file
  }
}

const databaseUrl = process.env.DATABASE_URL || "";
if (!databaseUrl) {
  console.error(
    "[prisma-provider] ERROR: DATABASE_URL is not set. Set it in .env or environment."
  );
  process.exit(1);
}

const provider = databaseUrl.startsWith("file:") ? "sqlite" : "postgresql";
console.log(`[prisma-provider] Provider: ${provider}`);

// Generate schema.prisma from template
let schema = readFileSync(templatePath, "utf-8");
schema = schema.replace(/__PROVIDER__/g, provider);

// SQLite doesn't support enums - convert to String with default values
if (provider === "sqlite") {
  // Replace enum type references with String (e.g. "JobStatus @default(PENDING)" -> "String @default(\"PENDING\")")
  schema = schema.replace(
    /(\w+)\s+JobStatus\s+@default\((\w+)\)/g,
    '$1    String    @default("$2")'
  );
  // Remove enum blocks
  schema = schema.replace(/\nenum\s+\w+\s*\{[^}]*\}\n?/g, "\n");
}

writeFileSync(outputPath, schema, "utf-8");
console.log("[prisma-provider] Generated prisma/schema.prisma");

// Run prisma generate
console.log("[prisma-provider] Running prisma generate...");
execSync("npx prisma generate", { cwd: projectRoot, stdio: "inherit" });

// Run prisma db push (unless --no-push flag)
const noPush = process.argv.includes("--no-push");
if (!noPush) {
  console.log("[prisma-provider] Running prisma db push...");
  execSync("npx prisma db push --skip-generate", {
    cwd: projectRoot,
    stdio: "inherit",
  });
  console.log("[prisma-provider] Database schema is up to date.");
}
