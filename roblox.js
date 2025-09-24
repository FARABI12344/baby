import fetch from "node-fetch";

// === Roblox AI (scripting assistant) ===
export async function getRobloxAI(userKey, userPrompt, useMemory, conversationMemory, MEMORY_LIMIT) {
  const instruction = `You are a Roblox scripting assistant.
You help users write Roblox Lua (Luau) scripts, debug issues, and explain code in simple, beginner-friendly ways.
Rules:
- Always provide valid Roblox Lua code when a script is requested.
- Keep answers clear and safe (no exploits, cheats, or harmful code).
- Be concise but explain important details.
- Use examples from Roblox Studio where helpful.
- Stay professional but approachable, like a friendly tutor.
`;

  // restore memory if enabled
  let history = [];
  if (useMemory) {
    const data = conversationMemory.get(userKey) || { history: [], lastActive: Date.now() };
    history = data.history.slice(-6); // last 3 exchanges
  }

  // build conversation text
  let chatHistoryText = history
    .map(msg => `${msg.isUser ? "User" : "Assistant"}: ${msg.text}`)
    .join("\n");

  // final prompt
  const fullPrompt = `${instruction}\n${chatHistoryText}\nUser: ${userPrompt}\nAssistant:`;

  // try models in order
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
          // update memory
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
