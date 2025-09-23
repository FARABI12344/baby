import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); // allow requests from anywhere

// AI endpoint
app.get("/api", async (req, res) => {
  const prompt = req.query.prompt;
  if (!prompt) return res.status(400).json({ error: "Missing prompt" });

  try {
    // Forward request to Pollinations
    const response = await fetch(
      "https://text.pollinations.ai/" + encodeURIComponent(prompt)
    );

    const text = await response.text();

    // Return JSON
    res.json({ reply: text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(PORT, () => console.log(`✅ AI Proxy running on port ${PORT}`));
