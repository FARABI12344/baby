import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// AI request with GET + fallback + retry + optional instruction
async function getAI(prompt) {
  const instruction = "You are a helpful AI assistant that always explains step by step. you made by ariyan";
  const configs = [
    { type: "get", model: "openai", system: instruction, label: "1st: model openai" },
    { type: "get", model: "mistral", system: instruction, label: "2nd: model mistral" },
    { type: "get", label: "3rd: fallback no model" } // fallback without model
  ];

  const maxAttempts = 5;
  let attempt = 0;
  let lastError = null;

  while (attempt < maxAttempts) {
    for (const config of configs) {
      try {
        let url;
        if (config.model) {
          url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=${config.model}&system=${encodeURIComponent(config.system)}`;
        } else {
          url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}`;
        }

        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`Status ${resp.status} ${resp.statusText}`);

        const text = await resp.text();
        if (text && text.trim().length > 0) {
          return { text: text.trim(), used: config.label };
        }

      } catch (err) {
        lastError = err;
        continue; // try next config
      }
    }
    attempt++;
  }

  throw new Error(`Failed to get AI response after ${maxAttempts} attempts. Last error: ${lastError ? lastError.message : "unknown error"}`);
}

app.get("/api", async (req, res) => {
  const prompt = req.query.prompt;
  if (!prompt) return res.status(400).send("Missing prompt");

  try {
    const result = await getAI(prompt);
    res.setHeader("Content-Type", "application/json");
    res.send(result); // send JSON: { text: "...", used: "1st: model openai" }
  } catch (err) {
    res.status(500).send({ error: "❌ AI request failed: " + err.message });
  }
});

app.listen(PORT, () => console.log(`✅ AI Proxy running on port ${PORT}`));
