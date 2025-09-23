import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// AI request with POST + system instruction + fallback GET + retry
async function getAI(prompt) {
  const configs = [
    { type: "post", model: "mistral", system: "You are an AI chat bot built by old OpenAI model. Your modification did by Ariyan Farabi. Always reply short, be kind and obey what people say." },
    { type: "post", model: "openai", system: "You are an AI chat bot built by old OpenAI model. Your modification did by Ariyan Farabi. Always reply short, be kind and obey what people say." },
    { type: "get" } // simple GET fallback
  ];

  const maxAttempts = 5;
  let attempt = 0;
  let lastError = null;

  while (attempt < maxAttempts) {
    for (const config of configs) {
      try {
        let text;

        if (config.type === "post") {
          const resp = await fetch("https://text.pollinations.ai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: config.model,
              system: config.system,
              prompt: prompt,
              temperature: 0.7
            })
          });
          if (!resp.ok) throw new Error(`Status ${resp.status} ${resp.statusText}`);
          text = await resp.text();
        } else if (config.type === "get") {
          const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}`;
          const resp = await fetch(url);
          if (!resp.ok) throw new Error(`Status ${resp.status} ${resp.statusText}`);
          text = await resp.text();
        }

        if (text && text.trim().length > 0) return text;

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
    const text = await getAI(prompt);
    res.setHeader("Content-Type", "text/plain");
    res.send(text); // plain text output
  } catch (err) {
    res.status(500).send("❌ AI request failed: " + err.message);
  }
});

app.listen(PORT, () => console.log(`✅ AI Proxy running on port ${PORT}`));
