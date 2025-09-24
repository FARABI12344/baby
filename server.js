import express from "express";
import cors from "cors";
import { getAI } from "./default.js";
import { getRobloxAI } from "./roblox.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Cooldown + memory maps (shared)
const cooldowns = new Map();
const COOLDOWN_MS = 1000;
const conversationMemory = new Map();
const MEMORY_LIMIT = 10;
const MEMORY_TTL = 60 * 1000;

// cleanup expired memory
setInterval(() => {
  const now = Date.now();
  for (const [user, data] of conversationMemory.entries()) {
    if (now - data.lastActive > MEMORY_TTL) {
      conversationMemory.delete(user);
    }
  }
}, 60 * 1000);

// Route handler
app.get("*", async (req, res) => {
  const prompt = req.query.prompt || req.path.slice(1);
  const user = req.query.user;
  const model = req.query.model || "default";
  const now = Date.now();

  if (!prompt) {
    res.status(400).send("❌ Missing prompt");
    return;
  }

  const userKey = user || req.ip;
  const useMemory = Boolean(user);

  // cooldown
  if (cooldowns.has(userKey)) {
    const lastTime = cooldowns.get(userKey);
    if (now - lastTime < COOLDOWN_MS) {
      res.status(429).send("⚡ Slow down, wait a sec!");
      return;
    }
  }
  cooldowns.set(userKey, now);

  try {
    let result;
    if (model === "roblox") {
      result = await getRobloxAI(userKey, prompt, useMemory, conversationMemory, MEMORY_LIMIT);
    } else {
      result = await getAI(userKey, prompt, useMemory, conversationMemory, MEMORY_LIMIT);
    }
    res.setHeader("Content-Type", "text/plain");
    res.send(result.text);
  } catch (err) {
    res.status(500).send(`❌ AI request failed: ${err.message}`);
  }
});

app.listen(PORT, () =>
  console.log(`✅ AI Proxy running on port ${PORT}`)
);
