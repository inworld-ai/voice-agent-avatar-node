import path from "path";

import {
  DEFAULT_LLM_MODEL_NAME,
  DEFAULT_PROVIDER,
  DEFAULT_TTS_MODEL_ID,
  DEFAULT_VAD_MODEL_PATH,
  DEFAULT_VOICE_ID,
} from "../constants";

/**
 * Attempts to extract agent name from systemPrompt.
 * Looks for patterns like "You are [Name]" or "I am [Name]".
 *
 * @param prompt - The system prompt text
 * @returns Extracted name or null if not found
 */
export function extractAgentNameFromPrompt(prompt: string): string | null {
  if (!prompt) return null;

  // Try to match "You are [Name]" or "I am [Name]" patterns
  // Match name up to first punctuation or specific keywords
  const patterns = [
    /You are ([A-Z][a-zA-Z\s]+?)(?:,|\.|\n| the | who | from )/i,
    /I am ([A-Z][a-zA-Z\s]+?)(?:,|\.|\n| the | who | from )/i,
  ];

  for (const pattern of patterns) {
    const match = prompt.match(pattern);
    if (match) {
      const name = match[1].trim();
      // Only take first 2-3 words to avoid overly long names
      const words = name.split(/\s+/).slice(0, 3);
      return words.join(" ");
    }
  }

  return null;
}

/**
 * Standardizes agent name to environment variable key format.
 * "Santa Claus" → "SANTA_CLAUS"
 * "Coach Dennis" → "COACH_DENNIS"
 *
 * @param name - Agent name to normalize
 * @returns Normalized name for env var lookup
 */
export function normalizeAgentName(name: string): string {
  return name
    .toUpperCase()
    .replace(/\s+/g, "_") // spaces → underscores
    .replace(/[^A-Z0-9_]/g, ""); // remove special characters
}

/**
 * Detects gender from system prompt using keyword-based detection.
 * Looks for gender-related pronouns and nouns.
 *
 * @param prompt - The system prompt text
 * @returns 'male', 'female', or null if not detected
 */
export function detectGenderFromPrompt(
  prompt: string,
): "male" | "female" | null {
  if (!prompt) return null;

  const lowerPrompt = prompt.toLowerCase();

  // Female indicators
  const femaleKeywords = [
    "she",
    "her",
    "woman",
    "female",
    "girl",
    "lady",
    "queen",
    "princess",
    "mother",
    "daughter",
    "sister",
    "wife",
    "girlfriend",
    "actress",
  ];

  // Male indicators
  const maleKeywords = [
    "he",
    "him",
    "his",
    "man",
    "male",
    "boy",
    "gentleman",
    "guy",
    "king",
    "prince",
    "father",
    "son",
    "brother",
    "husband",
    "boyfriend",
    "actor",
  ];

  // Count occurrences
  const femaleCount = femaleKeywords.filter((keyword) =>
    lowerPrompt.includes(keyword),
  ).length;
  const maleCount = maleKeywords.filter((keyword) =>
    lowerPrompt.includes(keyword),
  ).length;

  if (femaleCount > maleCount && femaleCount > 0) {
    console.log(
      `Detected gender "female" from keywords (${femaleCount} female vs ${maleCount} male)`,
    );
    return "female";
  } else if (maleCount > femaleCount && maleCount > 0) {
    console.log(
      `Detected gender "male" from keywords (${maleCount} male vs ${femaleCount} female)`,
    );
    return "male";
  }

  return null;
}

/**
 * Gets agent-specific voice and avatar configuration based on system prompt.
 * Priority: Agent-specific env vars → Gender-based defaults → System defaults
 *
 * @param systemPrompt - The system prompt to extract agent name from
 * @returns Configuration object with voiceId and heygenAvatarId
 */
export function getAgentConfig(systemPrompt: string): {
  voiceId: string;
  heygenAvatarId: string | undefined;
} {
  // 1. Try to extract agent name from prompt
  const agentName = extractAgentNameFromPrompt(systemPrompt);

  if (agentName) {
    const normalized = normalizeAgentName(agentName);

    // 2. Look for agent-specific environment variables
    const voiceId = process.env[`VOICE_ID_${normalized}`];
    const heygenAvatarId = process.env[`HEYGEN_AVATAR_ID_${normalized}`];

    if (voiceId || heygenAvatarId) {
      console.log(`Found config for agent "${agentName}":`, {
        voiceId: voiceId || "using default",
        heygenAvatarId: heygenAvatarId || "using default",
      });

      return {
        voiceId: voiceId || process.env.DEFAULT_VOICE_ID || DEFAULT_VOICE_ID,
        heygenAvatarId: heygenAvatarId || process.env.DEFAULT_HEYGEN_AVATAR_ID,
      };
    }
  }

  // 3. If no agent-specific config, detect gender and use gender-based defaults
  const gender = detectGenderFromPrompt(systemPrompt);

  if (gender === "female") {
    console.log(
      "Detected female character in custom prompt, using female voice and avatar",
    );
    return {
      voiceId: process.env.DEFAULT_FEMALE_VOICE_ID,
      heygenAvatarId: process.env.DEFAULT_FEMALE_HEYGEN_AVATAR_ID,
    };
  }

  // 4. Use default values (for male or undetected gender)
  console.log(
    `Using default voice and avatar${gender === "male" ? " (detected male)" : ""}`,
  );
  return {
    voiceId: process.env.DEFAULT_VOICE_ID || DEFAULT_VOICE_ID,
    heygenAvatarId: process.env.DEFAULT_HEYGEN_AVATAR_ID,
  };
}

export const parseEnvironmentVariables = () => {
  // All API keys are now optional (can be provided by client)
  const inworldApiKey = process.env.INWORLD_API_KEY?.trim();
  const assemblyAIApiKey = process.env.ASSEMBLY_AI_API_KEY?.trim();
  const heygenApiKey = process.env.HEYGEN_API_KEY?.trim();

  // Log configuration status for all API keys
  if (inworldApiKey) {
    console.log(`Inworld API key configured on server`);
  } else {
    console.log(`Inworld API key not set on server (can be provided by client)`);
  }

  if (assemblyAIApiKey) {
    console.log(`Assembly.AI API key configured on server`);
  } else {
    console.log(`Assembly.AI API key not set on server (can be provided by client)`);
  }

  if (heygenApiKey) {
    console.log(`HeyGen API key configured on server`);
  } else {
    console.log(`HeyGen API key not set on server (can be provided by client)`);
  }

  console.log(`Available STT service: Assembly.AI`);

  return {
    apiKey: inworldApiKey || "",
    llmModelName: process.env.LLM_MODEL_NAME || DEFAULT_LLM_MODEL_NAME,
    llmProvider: process.env.LLM_PROVIDER || DEFAULT_PROVIDER,
    voiceId: process.env.VOICE_ID || DEFAULT_VOICE_ID,
    vadModelPath:
      process.env.VAD_MODEL_PATH ||
      path.join(__dirname, DEFAULT_VAD_MODEL_PATH),
    ttsModelId: process.env.TTS_MODEL_ID || DEFAULT_TTS_MODEL_ID,
    graphVisualizationEnabled:
      (process.env.GRAPH_VISUALIZATION_ENABLED || "").toLowerCase().trim() ===
      "true",
    disableAutoInterruption:
      (process.env.DISABLE_AUTO_INTERRUPTION || "").toLowerCase().trim() ===
      "true",
    useAssemblyAI: true,
    assemblyAIApiKey: assemblyAIApiKey || "",
    heygenApiKey: heygenApiKey || "",
  };
};
