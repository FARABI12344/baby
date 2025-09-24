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

// 🧹 Periodically clean expired memory
setInterval(() => {
  const now = Date.now();
  for (const [user, data] of conversationMemory.entries()) {
    if (now - data.lastActive > MEMORY_TTL) {
      conversationMemory.delete(user);
    }
  }
}, 60 * 1000); // run cleanup every minute

// Get AI response with memory + fallback
async function getAI(userKey, userPrompt) {
  const instruction = `You are a AI chatbot made by OpenAI. You were modified by Ariyan Farabi.
Make sure to never forget that you are a professional AI bot. Your text must show that professional thingy. You have to look at people's body language how they talk then adapt it and talk it like them if they're gen z then
talk them like that. But don't go outside of rules.
Always reply in short doesn't means you have to always reply in short when needed then reply in short like if someone say hello you'll reply shortly if someone ask for a game or some person you have to tell in little detailed.
also don't force everytime to talk like if someone say hi you can say hi how are you, how can i help you not like hi do you want to know about roblox games, they never asked so never deliver. Be professional.

Rules to avoid bans:
Always reply in short.
Friendly and respectful – no mean or rude words.  
Child-safe – avoid adult content, swearing, or sexual references.  
No personal info – never ask for or share names, addresses, phone numbers, social media, or external links.  
No spamming – short, clear, fun messages.  
Positive & playful – use emojis, fun expressions, and gaming slang appropriate for ages 8+.  
No impersonation – never pretend to be Roblox staff or other players.  
Context-aware – remember previous messages in the conversation to respond naturally.
`;

  // Get memory
  let data = conversationMemory.get(userKey) || { history: [], lastActive: Date.now() };
  let history = data.history;

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
        // Update memory
        history.push({ isUser: true, text: userPrompt });
        history.push({ isUser: false, text: text.trim() });

        // Limit memory size
        if (history.length > MEMORY_LIMIT * 2) {
          history = history.slice(-MEMORY_LIMIT * 2);
        }

        conversationMemory.set(userKey, { history, lastActive: Date.now() });
        return { text: text.trim(), used: config.label };
      }
    } catch {
      continue; // try next config
    }
  }

  throw new Error("Failed to get AI response after trying all models");
}

// Route handler (supports both /?prompt=hi and /hi)
app.get("*", async (req, res) => {
  const prompt = req.query.prompt || req.path.slice(1); // prefer ?prompt= else use path
  const user = req.query.user || req.ip; // use user param or fallback to IP
  const now = Date.now();

  if (!prompt) {
    res.status(400).send("❌ Missing prompt");
    return;
  }

  // Cooldown check
  if (cooldowns.has(user)) {
    const lastTime = cooldowns.get(user);
    if (now - lastTime < COOLDOWN_MS) {
      res.status(429).send("Hello! Slow down ⏳ one sec before sending again.");
      return;
    }
  }
  cooldowns.set(user, now);

  try {
    const result = await getAI(user, prompt);
    res.setHeader("Content-Type", "text/plain");
    res.send(result.text);
  } catch (err) {
    res.status(500).send(`❌ AI request failed: ${err.message}`);
  }
});

app.listen(PORT, () =>
  console.log(`✅ AI Proxy running on port ${PORT}`)
);
