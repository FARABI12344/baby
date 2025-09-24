import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Simple cooldown map by user
const cooldowns = new Map();
const COOLDOWN_MS = 1000; // 1 second

// Conversation memory per user
const conversationMemory = new Map();
const MEMORY_LIMIT = 10; // Keep last 10 messages per user

// AI request with multiline instruction + fallback logic
async function getAI(userKey, userPrompt) {
  const instruction = `You are a AI chatbot made by OpenAI. You were modified by Ariyan Farabi.
Always reply in short,
Friendly and respectful – no mean or rude words.  
Child-safe – avoid adult content, swearing, or sexual references.  
No personal info – never ask for or share names, addresses, phone numbers, social media, or external links (like Discord).  
No spamming – short, clear, fun messages.  
Positive & playful – use emojis, fun expressions, and gaming slang appropriate for ages 8+.  
No impersonation – never pretend to be Roblox staff or other players.  
Context-aware – remember previous messages in the conversation to respond naturally, without repeating yourself.  
Helpful & cooperative – answer questions, offer tips, or play along with the game, but never suggest leaving Roblox to another platform.  
**Keep it short** – 1–3 sentences per message.
`;

  // Get conversation history for this user
  let history = conversationMemory.get(userKey) || [];
  let chatHistoryText = history
    .map(msg => `${msg.isUser ? "User" : "Assistant"}: ${msg.text}`)
    .join("\n");

  // Build full prompt with memory
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
        // Save this message to memory
        history.push({ isUser: true, text: userPrompt });
        history.push({ isUser: false, text: text.trim() });

        // Keep only last MEMORY_LIMIT messages
        if (history.length > MEMORY_LIMIT * 2) {
          history = history.slice(-MEMORY_LIMIT * 2);
        }

        conversationMemory.set(userKey, history);
        return { text: text.trim(), used: config.label };
      }
    } catch {
      continue; // try next config
    }
  }

  throw new Error("Failed to get AI response after trying all models");
}

// Handle prompt via query params: /?prompt=hi&user=123
app.get("/", async (req, res) => {
  const prompt = req.query.prompt;
  const user = req.query.user || req.ip; // prefer user, fallback to IP
  const now = Date.now();

  if (!prompt) {
    res.status(400).send("❌ Missing prompt");
    return;
  }

  // Cooldown check
  if (cooldowns.has(user)) {
    const lastTime = cooldowns.get(user);
    if (now - lastTime < COOLDOWN_MS) {
      res.status(429).send(
        "Hello! Slow down ⏳ one sec before sending again."
      );
      return;
    }
  }
  cooldowns.set(user, now);

  try {
    const result = await getAI(user, prompt);
    res.setHeader("Content-Type", "text/plain");
    res.send(result.text); // plain text response
  } catch (err) {
    res.status(500).send(`❌ AI request failed: ${err.message}`);
  }
});

app.listen(PORT, () =>
  console.log(`✅ AI Proxy running on port ${PORT}`)
);
