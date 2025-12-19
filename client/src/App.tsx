import "./App.css";

import { useCallback, useEffect, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import toast, { Toaster } from "react-hot-toast";
import { v4 } from "uuid";
import {
  LiveAvatarSession,
  SessionState,
  SessionEvent,
} from "@heygen/liveavatar-web-sdk";

import { Chat } from "./app/chat/Chat";
import { Layout } from "./app/components/Layout";
import { ConfigView } from "./app/configuration/ConfigView";
import {
  get as getConfiguration,
  save as saveConfiguration,
} from "./app/helpers/configuration";
import { Player } from "./app/sound/Player";
import {
  Agent,
  CHAT_HISTORY_TYPE,
  ChatHistoryItem,
  Configuration,
  InteractionLatency,
} from "./app/types";
import { config } from "./config";
import * as defaults from "./defaults";

interface CurrentContext {
  agent?: Agent;
  chatting: boolean;
  connection?: WebSocket;
  userName?: string;
  heygenSession?: LiveAvatarSession | null;
  isHeygenConnected?: boolean;
  heygenSessionToken?: string;
}

const player = new Player();
let key = "";

/**
 * Converts Float32 PCM audio (base64) to Int16 PCM (base64) for HeyGen.
 * HeyGen expects 16-bit signed PCM, but the server sends Float32 PCM.
 *
 * @param base64Float32 - Base64 encoded Float32 PCM audio
 * @returns Base64 encoded Int16 PCM audio
 */
function convertFloat32ToInt16PCM(base64Float32: string): string {
  try {
    // Decode base64 to get bytes
    const binaryString = atob(base64Float32);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Convert bytes to Float32Array (PCM Float32 samples)
    const float32Samples = new Float32Array(bytes.buffer);

    // Convert Float32 samples (-1.0 to 1.0) to Int16 samples (-32768 to 32767)
    const int16Samples = new Int16Array(float32Samples.length);
    for (let i = 0; i < float32Samples.length; i++) {
      // Clamp to [-1.0, 1.0] and convert to Int16 range
      const clamped = Math.max(-1, Math.min(1, float32Samples[i]));
      int16Samples[i] = Math.round(clamped * 32767);
    }

    // Convert Int16Array to base64
    const int16Bytes = new Uint8Array(int16Samples.buffer);
    let binaryStr = "";
    for (let i = 0; i < int16Bytes.length; i++) {
      binaryStr += String.fromCharCode(int16Bytes[i]);
    }

    return btoa(binaryStr);
  } catch (error) {
    console.error("Failed to convert Float32 to Int16 PCM:", error);
    // Return original if conversion fails
    return base64Float32;
  }
}

/**
 * Formats audio transcript text to ensure proper sentence structure:
 * - Starts with a capital letter
 * - Ends with a period (if final and not already ending with punctuation)
 */
function formatAudioTranscript(text: string, isFinal: boolean = true): string {
  if (!text || text.trim().length === 0) {
    return text;
  }

  let formatted = text.trim();

  // Capitalize first letter
  if (formatted.length > 0) {
    formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }

  // For final messages, ensure it ends with a period if it doesn't already end with punctuation
  if (isFinal) {
    const lastChar = formatted[formatted.length - 1];
    const endsWithPunctuation = /[.!?]/.test(lastChar);
    if (!endsWithPunctuation) {
      formatted += ".";
    }
  }

  return formatted;
}

/**
 * Attempts to extract agent name from systemPrompt.
 * Looks for patterns like "You are [Name]" or "I am [Name]".
 *
 * @param prompt - The system prompt text
 * @returns Extracted name or null if not found
 */
function extractAgentNameFromPrompt(prompt: string): string | null {
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
 * Gets the display name for the agent with fallback logic.
 * Priority: 1. Extract from prompt 2. Use configured name 3. Default "Assistant"
 *
 * @param systemPrompt - The system prompt to extract name from
 * @param configuredName - Manually configured agent name (optional)
 * @returns The agent display name
 */
function getAgentDisplayName(
  systemPrompt: string | undefined,
  configuredName: string | undefined,
): string {
  // 1. Try to extract from prompt
  if (systemPrompt) {
    const extractedName = extractAgentNameFromPrompt(systemPrompt);
    if (extractedName) {
      return extractedName;
    }
  }

  // 2. Use configured name if available
  if (configuredName && configuredName.trim()) {
    return configuredName.trim();
  }

  // 3. Default fallback
  return "Assistant";
}

function App() {
  const formMethods = useForm<Configuration>();

  const [open, setOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [connection, setConnection] = useState<WebSocket>();
  const [agent, setAgent] = useState<Agent>();
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [chatting, setChatting] = useState(false);
  const [userName, setUserName] = useState("");
  const [latencyData, setLatencyData] = useState<InteractionLatency[]>([]);
  const [heygenApiKey, setHeygenApiKey] = useState<string>();
  const [heygenConfigured, setHeygenConfigured] = useState(false);
  const [heygenSession, setHeygenSession] = useState<LiveAvatarSession | null>(
    null,
  );
  const [isHeygenConnected, setIsHeygenConnected] = useState(false);
  const [heygenSessionToken, setHeygenSessionToken] = useState<string>("");
  const [isHeygenStreamReady, setIsHeygenStreamReady] = useState(false);

  const currentInteractionId = useRef<string | null>(null);
  const stopRecordingRef = useRef<(() => void) | undefined>(undefined);
  const heygenVideoRef = useRef<HTMLVideoElement | null>(null);
  const agentConfigRef = useRef<{ heygenAvatarId?: string }>({});
  const stateRef = useRef<CurrentContext>({} as CurrentContext);
  stateRef.current = {
    agent,
    chatting,
    connection,
    userName,
    heygenSession,
    isHeygenConnected,
    heygenSessionToken,
  };

  const onOpen = useCallback(() => {
    console.log("Open!");
    setOpen(true);
  }, []);

  const onDisconnect = useCallback(() => {
    console.log("Disconnect!");
    setOpen(true);
  }, []);

  const onMessage = useCallback(
    async (message: MessageEvent) => {
      const packet = JSON.parse(message.data);
      let chatItem: ChatHistoryItem | undefined = undefined;

      if (packet?.type === "AUDIO") {
        // Audio routing: send to HeyGen if connected, otherwise play locally
        const {
          heygenSession: currentHeygenSession,
          isHeygenConnected: currentIsConnected,
        } = stateRef.current;

        if (currentIsConnected && currentHeygenSession) {
          try {
            // Convert Float32 PCM to Int16 PCM for HeyGen
            const convertedAudio = convertFloat32ToInt16PCM(packet.audio.chunk);

            await currentHeygenSession.repeatAudio(convertedAudio);
          } catch (error) {
            console.error(
              "Failed to send audio to HeyGen, using local player:",
              error,
            );
            player.addToQueue({ audio: packet.audio });
          }
        } else {
          player.addToQueue({ audio: packet.audio });
        }

        // Track first audio chunk for latency calculation (client-side)
        const interactionId = packet.packetId?.interactionId;
        if (interactionId) {
          setLatencyData((prev) => {
            const existing = prev.find(
              (item) => item.interactionId === interactionId,
            );

            if (existing && !existing.firstAudioTimestamp) {
              const firstAudioTimestamp = Date.now();
              // Calculate latency: prefer speechCompleteTimestamp, fallback to userTextTimestamp
              const startTimestamp =
                existing.speechCompleteTimestamp || existing.userTextTimestamp;
              const latencyMs = startTimestamp
                ? firstAudioTimestamp - startTimestamp
                : undefined;

              // Log latency with endpointing latency info for debugging
              const endpointingLatencyMs =
                existing.metadata?.endpointingLatencyMs || 0;
              if (latencyMs !== undefined && endpointingLatencyMs > 0) {
                const totalLatency = latencyMs + endpointingLatencyMs;
                console.log(
                  `Latency for interaction ${interactionId}: ${totalLatency}ms total ` +
                    `(${endpointingLatencyMs}ms endpointing + ${latencyMs}ms processing) ` +
                    `(from ${existing.speechCompleteTimestamp ? "speech complete" : "text input"})`,
                );
              } else if (latencyMs !== undefined) {
                console.log(
                  `Latency for interaction ${interactionId}: ${latencyMs}ms ` +
                    `(from ${existing.speechCompleteTimestamp ? "speech complete" : "text input"})`,
                );
              }

              return prev.map((item) =>
                item.interactionId === interactionId
                  ? { ...item, firstAudioTimestamp, latencyMs }
                  : item,
              );
            }
            return prev;
          });
        }
      } else if (packet?.type === "NEW_INTERACTION") {
        currentInteractionId.current = packet.packetId?.interactionId;
        const interactionId = packet.packetId?.interactionId;

        // Track userTextTimestamp for text-based interactions
        // This is when the NEW_INTERACTION arrives at the client (after text is sent)
        if (interactionId) {
          setLatencyData((prev) => {
            const existing = prev.find(
              (item) => item.interactionId === interactionId,
            );
            // Only create/update if we don't already have this interaction (from speech)
            if (!existing) {
              return [
                ...prev,
                {
                  interactionId,
                  userTextTimestamp: Date.now(),
                  userText: "", // Will be updated when we receive the text back
                },
              ];
            }
            return prev;
          });
        }
      } else if (packet?.type === "CANCEL_RESPONSE") {
        console.log("Cancel response: stopping audio playback");
        player.stop();

        // Send interrupt to HeyGen if connected
        const {
          heygenSession: currentHeygenSession,
          isHeygenConnected: currentIsConnected,
        } = stateRef.current;

        if (currentIsConnected && currentHeygenSession) {
          try {
            currentHeygenSession.interrupt();
            console.log("Sent interrupt to HeyGen avatar");
          } catch (error) {
            console.error("Failed to interrupt HeyGen:", error);
          }
        }
      } else if (packet?.type === "USER_SPEECH_COMPLETE") {
        // User's speech has been detected and processed (VAD detected end of speech)
        // Record timestamp on client side for latency measurement
        const interactionId = packet.packetId?.interactionId;
        const speechCompleteTimestamp = Date.now();

        console.log(
          `User speech complete for interaction ${interactionId}`,
          packet.metadata,
        );

        setLatencyData((prev) => {
          const existing = prev.find(
            (item) => item.interactionId === interactionId,
          );

          if (!existing) {
            // Create new entry for audio-based interaction
            return [
              ...prev,
              {
                interactionId,
                speechCompleteTimestamp,
                userText: "Voice input", // Will be updated when we receive the transcribed text
                metadata: packet.metadata,
              },
            ];
          } else {
            // Update existing entry with speech completion time
            return prev.map((item) =>
              item.interactionId === interactionId
                ? {
                    ...item,
                    speechCompleteTimestamp,
                    metadata: packet.metadata,
                  }
                : item,
            );
          }
        });
      } else if (packet?.type === "TEXT") {
        const { agent, userName } = stateRef.current || {};
        const textContent = packet.text.text || "";
        const trimmedText = textContent.trim();
        const isAgent = packet.routing?.source?.isAgent;

        // Only filter empty messages from USER (not from AGENT)
        if (trimmedText.length > 0 || isAgent === true) {
          // Format audio transcripts for user messages (ensure proper sentence structure)
          let displayText = packet.text.text;
          if (!isAgent) {
            displayText = formatAudioTranscript(
              packet.text.text,
              packet.text.final,
            );
          }

          chatItem = {
            id: packet.packetId?.utteranceId,
            type: CHAT_HISTORY_TYPE.ACTOR,
            date: new Date(packet.date!),
            source: {
              ...packet.routing?.source,
              name: isAgent ? agent?.name || "Assistant" : userName || "You",
            },
            text: displayText, // Formatted text for user messages, original for agent messages
            interactionId: packet.packetId?.interactionId,
            isRecognizing: !packet.text.final,
            author: isAgent === true ? agent?.name : userName,
          };

          // Update latency data with user text for display
          if (!isAgent && packet.text.final && packet.packetId?.interactionId) {
            const formattedUserText = formatAudioTranscript(trimmedText, true);
            setLatencyData((prev) => {
              return prev.map((item) =>
                item.interactionId === packet.packetId.interactionId &&
                !item.userText
                  ? { ...item, userText: formattedUserText }
                  : item,
              );
            });
          }
        } else {
          console.log(
            "Filtered out empty USER text message - not adding to chat",
          );
        }
      } else if (packet?.type === "INTERACTION_END") {
        chatItem = {
          id: v4(),
          type: CHAT_HISTORY_TYPE.INTERACTION_END,
          date: new Date(packet.date!),
          source: packet.routing?.source,
          interactionId: packet.packetId?.interactionId,
        };
      } else if (packet?.type === "ERROR") {
        // Stop recording if active when any error occurs
        if (stopRecordingRef.current) {
          console.log("Stopping recording due to error");
          stopRecordingRef.current();
        }

        toast.error(packet?.error ?? "Something went wrong");
      }

      if (chatItem) {
        setChatHistory((currentState) => {
          let newState = undefined;

          // For partial/recognizing messages, find by interactionId + isRecognizing
          // This allows us to update the same message as it's being transcribed
          let currentHistoryIndex = -1;
          if (
            chatItem.type === CHAT_HISTORY_TYPE.ACTOR &&
            chatItem.isRecognizing
          ) {
            currentHistoryIndex = currentState.findIndex((item) => {
              return (
                item.type === CHAT_HISTORY_TYPE.ACTOR &&
                item.interactionId === chatItem?.interactionId &&
                item.isRecognizing === true &&
                item.source?.isAgent === chatItem?.source?.isAgent
              );
            });
          } else if (
            chatItem.type === CHAT_HISTORY_TYPE.ACTOR &&
            !chatItem.isRecognizing
          ) {
            // For final messages, check if there's a partial message to replace
            const partialIndex = currentState.findIndex((item) => {
              return (
                item.type === CHAT_HISTORY_TYPE.ACTOR &&
                item.interactionId === chatItem?.interactionId &&
                item.isRecognizing === true &&
                item.source?.isAgent === chatItem?.source?.isAgent
              );
            });

            if (partialIndex >= 0) {
              // Replace the partial message with the final one
              currentHistoryIndex = partialIndex;
            } else {
              // Otherwise, find by utteranceId (for agent messages or direct updates)
              currentHistoryIndex = currentState.findIndex((item) => {
                return item.id === chatItem?.id;
              });
            }
          } else {
            // For non-ACTOR messages (like INTERACTION_END), find by id
            currentHistoryIndex = currentState.findIndex((item) => {
              return item.id === chatItem?.id;
            });
          }

          if (currentHistoryIndex >= 0 && chatItem) {
            // Update existing item
            newState = [...currentState];
            newState[currentHistoryIndex] = chatItem;
          } else {
            // Add new item
            newState = [...currentState, chatItem!];
          }
          return newState;
        });
      }
    },
    [], // Empty dependencies - we use stateRef for latest HeyGen state
  );

  const startHeygenSession = useCallback(async () => {
    try {
      // Get avatar ID from agent config
      const avatarId = agentConfigRef.current?.heygenAvatarId;
      
      // Get HeyGen API key from form (if provided by client)
      const { apiKeys } = formMethods.getValues();
      const heygenApiKey = apiKeys?.heygenApiKey;

      // Request session token from server
      const response = await fetch(
        `${config.LOAD_URL.replace("/load", "/api/start-session")}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ 
            avatarId,
            heygenApiKey, // Pass client-provided API key
          }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        console.error("Failed to get HeyGen token:", error);
        throw new Error(error.error || "Failed to get HeyGen session token");
      }

      const data = await response.json();
      const { token } = data;
      setHeygenSessionToken(token);

      // Create HeyGen session
      const sessionConfig = {
        apiUrl: "https://api.liveavatar.com",
      };
      const session = new LiveAvatarSession(token, sessionConfig);

      // Listen for session state changes
      session.on(SessionEvent.SESSION_STATE_CHANGED, (state: SessionState) => {
        if (state === SessionState.CONNECTED) {
          setIsHeygenConnected(true);
        } else if (state === SessionState.DISCONNECTED) {
          setIsHeygenConnected(false);
          setIsHeygenStreamReady(false);
          session.removeAllListeners();
        }
      });

      // Listen for stream ready event
      session.on(SessionEvent.SESSION_STREAM_READY, () => {
        setIsHeygenStreamReady(true);
        toast.success("HeyGen avatar ready");
      });

      // Listen for errors
      session.on("error", (error: any) => {
        console.error("HeyGen session error:", error);
        toast.error(`HeyGen error: ${error.message || "Unknown error"}`);
      });

      setHeygenSession(session);
      await session.start();
    } catch (error) {
      console.error("Error starting HeyGen session:", error);
      throw error;
    }
  }, [formMethods]);

  const openConnection = useCallback(async () => {
    key = v4();
    const { agent, user, apiKeys } = formMethods.getValues();

    setChatting(true);
    setUserName(user?.name!);

    // Check if Heygen is configured on server or provided by client
    let shouldStartHeygen = false;
    try {
      const configResponse = await fetch(config.CONFIG_URL);
      const configData = await configResponse.json();
      const serverHeygenConfigured = configData.heygenApiKeyConfigured || false;
      const clientHeygenProvided = !!(apiKeys?.heygenApiKey);
      
      shouldStartHeygen = serverHeygenConfigured || clientHeygenProvided;
      setHeygenConfigured(shouldStartHeygen);
      
      if (serverHeygenConfigured) {
        setHeygenApiKey("server-configured");
      } else if (clientHeygenProvided) {
        setHeygenApiKey(apiKeys.heygenApiKey);
      }
    } catch (error) {
      console.error("Failed to fetch server configuration:", error);
      setHeygenConfigured(false);
      shouldStartHeygen = false;
    }

    const response = await fetch(`${config.LOAD_URL}?sessionId=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userName: user?.name,
        agent,
        sttService: "assemblyai", // Always use Assembly.AI (only supported STT service)
        apiKeys: {
          inworldApiKey: apiKeys?.inworldApiKey,
          assemblyAiApiKey: apiKeys?.assemblyAiApiKey,
          heygenApiKey: apiKeys?.heygenApiKey,
        },
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      setChatting(false);

      // Handle STT service configuration errors
      if (data.error && data.requestedService) {
        const envVarMap: { [key: string]: string } = {
          assemblyai: "ASSEMBLY_AI_API_KEY",
        };

        const envVar = envVarMap[data.requestedService];
        const availableList =
          data.availableServices?.join(", ") || "assemblyai";

        // Build error message
        let errorMessage = data.error;
        if (envVar) {
          errorMessage += `\n\nPlease set the ${envVar} environment variable on the server.`;
        }
        if (data.error.includes("Only Assembly.AI STT is supported")) {
          errorMessage += `\n\nThe requested STT service "${data.requestedService}" is not supported. Only Assembly.AI is available.`;
        }
        errorMessage += `\n\nAvailable STT services: ${availableList}`;

        toast.error(errorMessage, {
          duration: 8000,
          style: {
            maxWidth: "500px",
          },
        });

        console.error("STT Service Error:", {
          error: data.error,
          requestedService: data.requestedService,
          availableServices: data.availableServices,
          requiredEnvVar: envVar,
        });
      } else {
        // Generic error handling
        toast.error(
          `Failed to create session: ${data.errors || response.statusText}`,
        );
        console.log(response.statusText, ": ", data.errors);
      }

      return;
    }

    if (data.agent) {
      // Extract agent display name from prompt or use configured name
      const agentDisplayName = getAgentDisplayName(
        agent?.systemPrompt,
        agent?.name,
      );

      setAgent({
        ...data.agent,
        name: agentDisplayName,
      } as Agent);
    }

    // Save agent config for HeyGen avatar
    if (data.agentConfig) {
      agentConfigRef.current = data.agentConfig;
    }

    // Add a small delay to ensure server has fully processed the session
    // This prevents race conditions where WebSocket connects before session is ready
    await new Promise((resolve) => setTimeout(resolve, 100));

    const ws = new WebSocket(`${config.SESSION_URL}?sessionId=${key}`);

    // Add error handler for WebSocket connection failures
    ws.addEventListener("error", (error) => {
      console.error("WebSocket error:", error);
      toast.error("Failed to establish WebSocket connection");
      setChatting(false);
    });

    // Add close handler to detect unexpected disconnections
    ws.addEventListener("close", (event) => {
      if (event.code === 1008) {
        console.error("WebSocket closed: Session not found");
        toast.error("Session not found. Please try again.");
        setChatting(false);
      } else if (!event.wasClean) {
        console.error(
          "WebSocket closed unexpectedly:",
          event.code,
          event.reason,
        );
      }
    });

    setConnection(ws);

    ws.addEventListener("open", onOpen);
    ws.addEventListener("message", onMessage);
    ws.addEventListener("disconnect", onDisconnect);

    // Start HeyGen session if configured on server
    if (shouldStartHeygen) {
      try {
        await startHeygenSession();
      } catch (error) {
        console.error("Failed to start HeyGen session:", error);
        toast.error("Failed to connect to HeyGen avatar");
        // If HeyGen fails to connect, continue without it
        setHeygenConfigured(false);
        setHeygenApiKey(undefined);
      }
    }
  }, [formMethods, onDisconnect, onMessage, onOpen, startHeygenSession]);

  const stopChatting = useCallback(async () => {
    const {
      connection,
      heygenSession: currentHeygenSession,
      heygenSessionToken: currentToken,
    } = stateRef.current;

    setChatting(false);
    setOpen(false);
    player.stop();

    // Stop HeyGen session if active
    if (currentHeygenSession) {
      try {
        await currentHeygenSession.stop();

        if (currentToken) {
          try {
            await fetch(
              `${config.LOAD_URL.replace("/load", "/api/stop-session")}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ session_token: currentToken }),
              },
            );
          } catch (error) {
            console.error("Failed to stop HeyGen session on server:", error);
          }
        }

        setHeygenSession(null);
        setIsHeygenConnected(false);
        setIsHeygenStreamReady(false);
        setHeygenSessionToken("");
      } catch (error) {
        console.error("Error stopping HeyGen session:", error);
      }
    }

    // Clear collections (only when fully exiting to config)
    setChatHistory([]);
    setLatencyData([]);

    // Close connection and clear connection data
    if (connection) {
      connection.close();
      connection.removeEventListener("open", onOpen);
      connection.removeEventListener("message", onMessage);
      connection.removeEventListener("disconnect", onDisconnect);
      // Note: error and close handlers are removed automatically when connection closes
    }

    setConnection(undefined);
    setAgent(undefined);

    await fetch(`${config.UNLOAD_URL}?sessionId=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    key = "";
  }, [onDisconnect, onMessage, onOpen]);

  const resetForm = useCallback(() => {
    formMethods.reset({
      ...defaults.configuration,
    });
    saveConfiguration(formMethods.getValues());
  }, [formMethods]);

  useEffect(() => {
    const configuration = getConfiguration();
    const parsedConfiguration = configuration
      ? JSON.parse(configuration)
      : defaults.configuration;

    // Normalize sttService to 'assemblyai' (remove any old values like 'inworld' or 'groq')
    formMethods.reset({
      ...parsedConfiguration,
      sttService: "assemblyai",
    });

    setInitialized(true);
  }, [formMethods]);

  useEffect(() => {
    player.preparePlayer();
  }, []);

  const content = chatting ? (
    <Chat
      chatHistory={chatHistory}
      connection={connection}
      onStopChatting={stopChatting}
      userName={userName}
      latencyData={latencyData}
      onStopRecordingRef={stopRecordingRef}
      isLoaded={open && !!agent}
      heygenApiKey={heygenApiKey}
      heygenSession={heygenSession}
      isHeygenConnected={isHeygenConnected}
      isHeygenStreamReady={isHeygenStreamReady}
      heygenVideoRef={heygenVideoRef}
    />
  ) : (
    <ConfigView
      canStart={formMethods.formState.isValid}
      onStart={() => openConnection()}
      onResetForm={resetForm}
    />
  );

  return (
    <FormProvider {...formMethods}>
      <Toaster
        toastOptions={{
          style: {
            maxWidth: "fit-content",
            wordBreak: "break-word",
          },
        }}
      />
      <Layout>{initialized ? content : ""}</Layout>
    </FormProvider>
  );
}

export default App;
