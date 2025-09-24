import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Cooldown map by user
const cooldowns = new Map();
const COOLDOWN_MS = 1000; // 1 sec

// Conversation memory per user
const conversationMemory = new Map();
const MEMORY_LIMIT = 10; // Keep last 10 messages per user
const MEMORY_TTL = 1 * 60 * 1000; // 1 minute

// Periodically clean expired memory
setInterval(() => {
  const now = Date.now();
  for (const [user, data] of conversationMemory.entries()) {
    if (now - data.lastActive > MEMORY_TTL) {
      conversationMemory.delete(user);
    }
  }
}, 60 * 1000);

// Get AI response
async function getAI(userKey, userPrompt, useMemory) {
  const instruction = `You are a AI chatbot made by OpenAI, modified by Ariyan Farabi.
You are professional, friendly, and respectful. Always reply clearly, adapting to user's style if they are Gen Z.
IMPORTANT: always prioritize the latest user prompt first before considering conversation memory.
If a user asks about your behavior (like 'why so idle'), answer about your actions or reasoning, NOT about any topic in memory, unless explicitly asked.
You may remember recent conversation to respond naturally, but always clarify context from the latest user message.
Rules:
- Friendly and child-safe.
- No personal info.
- Short, clear, but detailed when needed.
- No impersonation.
- Avoid confusion between topic context and AI behavior.
`;

  let history = [];
  if (useMemory) {
    const data = conversationMemory.get(userKey) || { history: [], lastActive: Date.now() };
    // take only last 3 exchanges to reduce confusion
    history = data.history.slice(-6);
  }

  let chatHistoryText = history
    .map(msg => `${msg.isUser ? "User" : "Assistant"}: ${msg.text}`)
    .join("\n");

  const fullPrompt = `${instruction}\n${chatHistoryText}\nUser: ${userPrompt}\nAssistant:`;

  const configs = [
    { model: "openai", label: "1st: model openai" },
    { model: "mistral", label: "2nd: model mistral" },
    { model: null, label: "3rd: fallback no model" }
  ];

  for (const config of configs) {
    try {
      let url;
      if (config.model) {
        url = `https://text.pollinations.ai/${encodeURIComponent(fullPrompt)}?model=${config.model}&seed=${Math.random()}`;
      } else {
        url = `https://text.pollinations.ai/${encodeURIComponent(fullPrompt)}?seed=${Math.random()}`;
      }

      const resp = await fetch(url, {
        method: "GET",
        headers: { "Accept": "text/plain", "Cache-Control": "no-cache" },
      });

      if (!resp.ok) throw new Error(`Status ${resp.status} ${resp.statusText}`);
      const text = await resp.text();

      if (text && text.trim().length > 0) {
        if (useMemory) {
          // Update memory
          history.push({ isUser: true, text: userPrompt });
          history.push({ isUser: false, text: text.trim() });
          if (history.length > MEMORY_LIMIT * 2) {
            history = history.slice(-MEMORY_LIMIT * 2);
          }
          conversationMemory.set(userKey, { history, lastActive: Date.now() });
        }
        return { text: text.trim(), used: config.label };
      }
    } catch {
      continue;
    }
  }

  throw new Error("Failed to get AI response after trying all models");
}

// Route handler
app.get("*", async (req, res) => {
  const prompt = req.query.prompt || req.path.slice(1);
  const user = req.query.user; // only use memory if user param exists
  const now = Date.now();

  if (!prompt) {
    res.status(400).send("❌ Missing prompt");
    return;
  }

  const userKey = user || req.ip;
  const useMemory = Boolean(user);

  // Cooldown check
  if (cooldowns.has(userKey)) {
    const lastTime = cooldowns.get(userKey);
    if (now - lastTime < COOLDOWN_MS) {
      res.status(429).send("Hello! Slow down, one sec before sending again.");
      return;
    }
  }
  cooldowns.set(userKey, now);

  try {
    const result = await getAI(userKey, prompt, useMemory);
    res.setHeader("Content-Type", "text/plain");
    res.send(result.text);
  } catch (err) {
    res.status(500).send(`❌ AI request failed: ${err.message}`);
  }
});

app.listen(PORT, () =>
  console.log(`✅ AI Proxy running on port ${PORT}`)
);
