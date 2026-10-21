const agent = process.env.npm_config_user_agent ?? "";

if (!agent.startsWith("pnpm/")) {
  console.error("");
  console.error("This repository uses pnpm only. Run `pnpm install` instead.");
  console.error(`Detected package manager: ${agent || "unknown"}`);
  console.error("");
  process.exit(1);
}
