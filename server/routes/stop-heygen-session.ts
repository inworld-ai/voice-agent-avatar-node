import { Request, Response } from "express";

export async function stopHeygenSession(req: Request, res: Response) {
  try {
    const { session_token } = req.body;

    if (!session_token) {
      return res.status(400).json({
        error: "session_token is required",
      });
    }

    // Call HeyGen API to stop session
    // Use Bearer token authentication (matching SessionAPIClient pattern)
    const response = await fetch(
      "https://api.liveavatar.com/v1/sessions/stop",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session_token}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Error stopping HeyGen session:", errorData);
      return res.status(response.status).json({
        error: errorData.data?.message || "Failed to stop session",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Session stopped successfully",
    });
  } catch (error) {
    console.error("Error stopping HeyGen session:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
