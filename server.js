import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// AI request with embedded instruction + fallback logic
async function getAI(userPrompt) {
  const instruction = `You are a helpful AI assistant that always explains step by step. You were made by Ariyan.`;

  // Embed instruction directly into prompt
  const fullPrompt = `${instruction}\nUser: ${userPrompt}\nAssistant:`;

  const configs = [
    { type: "get", model: "openai", label: "1st: model openai" },
    { type: "get", model: "mistral", label: "2nd: model mistral" },
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
          // model-specific GET request
          url = `https://text.pollinations.ai/${encodeURIComponent(fullPrompt)}?model=${config.model}&seed=${Math.random()}`;
        } else {
          // fallback without model
          url = `https://text.pollinations.ai/${encodeURIComponent(fullPrompt)}?seed=${Math.random()}`;
        }

        const resp = await fetch(url, {
          method: "GET",
          headers: { "Accept": "text/plain", "Cache-Control": "no-cache" }
        });

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
  if (!prompt) return res.status(400).send({ error: "Missing prompt" });

  try {
    const result = await getAI(prompt);
    res.setHeader("Content-Type", "application/json");
    res.send(result); // { text: "...", used: "1st: model openai" }
  } catch (err) {
    res.status(500).send({ error: "❌ AI request failed: " + err.message });
  }
});

app.listen(PORT, () => console.log(`✅ AI Proxy running on port ${PORT}`));
