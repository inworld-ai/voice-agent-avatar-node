import { Request, Response } from "express";

export async function startHeygenSession(req: Request, res: Response) {
  try {
    const { avatarId, heygenApiKey: clientHeygenApiKey } = req.body;
    
    // Use client-provided API key or fall back to server env var
    const heygenApiKey = clientHeygenApiKey || process.env.HEYGEN_API_KEY;

    if (!heygenApiKey) {
      return res.status(400).json({
        error: "HeyGen API Key not configured on server or provided by client",
      });
    }

    // Use provided avatarId or fall back to default
    const finalAvatarId = avatarId || process.env.DEFAULT_HEYGEN_AVATAR_ID;

    // Call HeyGen API to create session
    // Note: We use Inworld TTS for voice, so we only need the avatar for visual display
    const response = await fetch(
      "https://api.liveavatar.com/v1/sessions/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": heygenApiKey,
        },
        body: JSON.stringify({
          mode: "CUSTOM", // CUSTOM mode: we provide our own audio (from Inworld TTS)
          avatar_id: finalAvatarId,
          quality: "high",
        }),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      console.error("HeyGen API error:", error);
      return res.status(response.status).json({
        error: "Failed to create HeyGen session",
        details: error,
      });
    }

    const data = await response.json();

    return res.status(200).json({
      token: data.data.session_token,
      sessionId: data.data.session_id,
    });
  } catch (error) {
    console.error("Error starting HeyGen session:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
