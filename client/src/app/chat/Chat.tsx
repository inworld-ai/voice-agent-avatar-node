import { ArrowBackRounded, ArrowUpward, Mic } from "@mui/icons-material";
import {
  Box,
  Button,
  Collapse,
  Fade,
  IconButton,
  Link,
  Slide,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveAvatarSession } from "@heygen/liveavatar-web-sdk";

import { INPUT_SAMPLE_RATE } from "../../../../constants";
import { config } from "../../config";
import { ChatHistoryItem, InteractionLatency } from "../types";
import { RecordIcon } from "./Chat.styled";
import { History } from "./History";
import { LatencyChart } from "./LatencyChart";

interface ChatProps {
  chatHistory: ChatHistoryItem[];
  connection?: WebSocket;
  onStopChatting: () => void;
  userName: string;
  latencyData: InteractionLatency[];
  onStopRecordingRef?: React.MutableRefObject<(() => void) | undefined>;
  isLoaded: boolean;
  heygenApiKey?: string;
  heygenSession?: LiveAvatarSession | null;
  isHeygenConnected?: boolean;
  isHeygenStreamReady?: boolean;
  heygenVideoRef?: React.MutableRefObject<HTMLVideoElement | null>;
}

let interval: ReturnType<typeof setInterval>;
let stream: MediaStream;
let audioCtx: AudioContext;
let audioWorkletNode: AudioWorkletNode;

export function Chat(props: ChatProps) {
  const {
    chatHistory,
    connection,
    latencyData,
    onStopRecordingRef,
    isLoaded,
    heygenApiKey,
    heygenSession,
    isHeygenConnected,
    isHeygenStreamReady,
    heygenVideoRef,
  } = props;

  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [showTextWidget, setShowTextWidget] = useState(false);

  // Track if we've started chatting for layout transitions
  const hasStartedChat = chatHistory.length > 0;

  // Track attached video element to avoid duplicate attachments
  const attachedVideoRef = useRef<HTMLVideoElement | null>(null);

  const handleVideoRef = useCallback(
    (videoElement: HTMLVideoElement | null) => {
      if (heygenVideoRef) {
        heygenVideoRef.current = videoElement;
      }

      if (videoElement && isHeygenStreamReady && heygenSession) {
        if (attachedVideoRef.current !== videoElement) {
          heygenSession.attach(videoElement);
          attachedVideoRef.current = videoElement;
        }
      } else if (!videoElement) {
        attachedVideoRef.current = null;
      }
    },
    [isHeygenStreamReady, heygenSession],
  );

  // Attach when stream becomes ready (in case video element exists but stream wasn't ready)
  useEffect(() => {
    if (isHeygenStreamReady && heygenSession && heygenVideoRef?.current) {
      if (attachedVideoRef.current !== heygenVideoRef.current) {
        heygenSession.attach(heygenVideoRef.current);
        attachedVideoRef.current = heygenVideoRef.current;
      }
    }
  }, [isHeygenStreamReady, heygenSession]);

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setText(e.target.value);
    },
    [],
  );

  // Shared HeyGen Video Component
  const renderHeygenVideo = () => {
    if (!heygenApiKey) return null;

    return (
      <Box
        sx={{
          width: "100%",
          maxWidth: "800px",
          aspectRatio: "16/9",
          position: "relative",
          backgroundColor: "#E1E9DD",
          borderRadius: "12px",
          overflow: "hidden",
          border: "1px solid #D6D1CB",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
          transition: "all 2.4s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <video
          ref={handleVideoRef}
          autoPlay
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: isHeygenStreamReady ? "block" : "none",
          }}
        />
        {!isHeygenStreamReady && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background:
                "linear-gradient(135deg, #E1E9DD 0%, #D4DDD0 100%)",
            }}
          >
            <Box sx={{ textAlign: "center" }}>
              <Box
                sx={{
                  width: "120px",
                  height: "120px",
                  backgroundColor: "#0C6B4D",
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                  boxShadow: "0 4px 12px rgba(12, 107, 77, 0.3)",
                }}
              >
                <Typography
                  sx={{
                    fontSize: "56px",
                    fontWeight: 700,
                    color: "white",
                    fontFamily: "Inter, Arial, sans-serif",
                  }}
                >
                  H
                </Typography>
              </Box>
              <Typography
                variant="body1"
                sx={{
                  color: "#3F3B37",
                  fontFamily: "Inter, Arial, sans-serif",
                  fontWeight: 600,
                  fontSize: "16px",
                  mb: 1,
                }}
              >
                HeyGen Live Avatar
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: "#817973",
                  fontFamily: "Inter, Arial, sans-serif",
                  fontSize: "14px",
                }}
              >
                {isHeygenStreamReady
                  ? "Connected"
                  : isHeygenConnected
                    ? "Loading stream..."
                    : "Connecting..."}
              </Typography>
            </Box>
          </Box>
        )}
        {isHeygenStreamReady && (
          <Box
            sx={{
              position: "absolute",
              top: 16,
              right: 16,
              display: "flex",
              alignItems: "center",
              gap: 1,
              backgroundColor: "rgba(255, 255, 255, 0.95)",
              backdropFilter: "blur(8px)",
              px: 2,
              py: 1,
              borderRadius: "8px",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
            }}
          >
            <Box
              sx={{
                width: "8px",
                height: "8px",
                backgroundColor: "#22C55E",
                borderRadius: "50%",
                animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                "@keyframes pulse": {
                  "0%, 100%": { opacity: 1 },
                  "50%": { opacity: 0.5 },
                },
              }}
            />
            <Typography
              variant="caption"
              sx={{
                color: "#3F3B37",
                fontFamily: "Inter, Arial, sans-serif",
                fontSize: "12px",
                fontWeight: 500,
              }}
            >
              Ready
            </Typography>
          </Box>
        )}
      </Box>
    );
  };

  const stopRecording = useCallback(() => {
    setIsRecording(false);
    clearInterval(interval);
    stream?.getTracks().forEach((track) => track.stop());
    audioWorkletNode?.disconnect();
    if (connection && connection.readyState === WebSocket.OPEN) {
      connection.send(JSON.stringify({ type: "audioSessionEnd" }));
    }
  }, [connection]);

  // Expose stopRecording to parent via ref
  useEffect(() => {
    if (onStopRecordingRef) {
      onStopRecordingRef.current = stopRecording;
    }
    return () => {
      if (onStopRecordingRef) {
        onStopRecordingRef.current = undefined;
      }
    };
  }, [stopRecording, onStopRecordingRef]);

  // Cleanup on unmount or connection close
  useEffect(() => {
    return () => {
      // Stop recording and clear interval when component unmounts
      if (isRecording) {
        clearInterval(interval);
        stream?.getTracks().forEach((track) => track.stop());
        audioWorkletNode?.disconnect();
      }
    };
  }, []);

  // Monitor connection state and stop recording if it closes
  useEffect(() => {
    if (!connection) return;

    const handleClose = () => {
      if (isRecording) {
        stopRecording();
      }
    };

    connection.addEventListener("close", handleClose);
    connection.addEventListener("error", handleClose);

    return () => {
      connection.removeEventListener("close", handleClose);
      connection.removeEventListener("error", handleClose);
    };
  }, [connection, isRecording, stopRecording]);

  const startRecording = useCallback(async () => {
    if (!connection || !isLoaded) return;

    try {
      setIsRecording(true);

      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: INPUT_SAMPLE_RATE,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      audioCtx = new AudioContext({
        sampleRate: INPUT_SAMPLE_RATE,
      });

      // Load the AudioWorklet processor
      await audioCtx.audioWorklet.addModule("/audio-processor.worklet.js");

      // Create the audio source and worklet node
      const source = audioCtx.createMediaStreamSource(stream);
      audioWorkletNode = new AudioWorkletNode(
        audioCtx,
        "audio-capture-processor",
      );

      // Collect audio samples from the worklet
      let leftChannel: Float32Array[] = [];

      audioWorkletNode.port.onmessage = (event) => {
        // Receive samples from the audio worklet thread
        leftChannel.push(new Float32Array(event.data.samples));
      };

      // Connect source to worklet (no need to connect to destination!)
      source.connect(audioWorkletNode);

      // Send accumulated audio chunks periodically
      interval = setInterval(() => {
        if (leftChannel.length > 0 && connection) {
          // Check if WebSocket is still open before sending
          if (connection.readyState === WebSocket.OPEN) {
            connection.send(
              JSON.stringify({
                type: "audio",
                audio: leftChannel,
              }),
            );
          }
          // Clear buffer regardless of send status
          leftChannel = [];
        }
      }, 100);
    } catch (e) {
      console.error("Error starting recording:", e);
      setIsRecording(false); // Reset state on error
      throw e; // Re-throw to see the error
    }
  }, [connection, isLoaded]);

  const handleSend = useCallback(() => {
    if (!connection || !isLoaded) return;

    const trimmedText = text.trim();
    if (trimmedText && trimmedText.length > 0) {
      // Check if WebSocket is still open before sending
      if (connection.readyState === WebSocket.OPEN) {
        connection.send(JSON.stringify({ type: "text", text: trimmedText }));
        setText("");
      }
    }
  }, [connection, text, isLoaded]);

  const handleTextKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        handleSend();
      }
    },
    [handleSend],
  );

  const handleSpeakClick = useCallback(async () => {
    if (!isLoaded || !connection) return;

    if (isRecording) {
      stopRecording();
      return;
    }

    // When starting recording at center position, also open text widget
    if (chatHistory.length === 0) {
      setShowTextWidget(true);
    }

    return startRecording();
  }, [
    isRecording,
    startRecording,
    stopRecording,
    chatHistory.length,
    isLoaded,
    connection,
  ]);

  const handleTypeInstead = useCallback(() => {
    setShowTextWidget(true);
  }, []);

  const handleCloseTextWidget = useCallback(() => {
    setShowTextWidget(false);
    setText("");
  }, []);

  return (
    <>
      {/* Full-width background matching ConfigView */}
      <Box
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          backgroundColor: "#FAF7F5",
          zIndex: -1,
        }}
      />

      {/* Latency Chart */}
      {config.ENABLE_LATENCY_REPORTING && (
        <LatencyChart latencyData={latencyData} />
      )}

      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          position: "relative",
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            p: 3,
            backgroundColor: "transparent",
          }}
        >
          <Button
            startIcon={<ArrowBackRounded />}
            onClick={props.onStopChatting}
            variant="outlined"
            size="small"
            sx={{
              borderColor: "#E9E5E0",
              color: "#5C5652",
              fontFamily: "Inter, Arial, sans-serif",
              fontSize: "14px",
              fontWeight: 500,
              textTransform: "none",
              borderRadius: "8px",
              px: 2,
              py: 1,
              "&:hover": {
                borderColor: "#D6D1CB",
                backgroundColor: "#f4f0eb",
              },
            }}
          >
            Back to settings
          </Button>
        </Box>

        {/* Content Area - Different layouts based on state */}
        {/* Unified layout: HeyGen video position transitions smoothly */}

        {/* HeyGen Video - Always rendered if API key exists, position changes based on chat state */}
        {heygenApiKey && (
          <Box
            sx={{
              px: 3,
              pb: hasStartedChat ? 2 : 0,
              pt: hasStartedChat ? 0 : 0,
              display: "flex",
              justifyContent: "center",
              alignItems: hasStartedChat ? "flex-start" : "center",
              flex: hasStartedChat ? 0 : 1,
              transition: "all 2.4s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            {renderHeygenVideo()}
          </Box>
        )}

        {/* Content below video */}
        {chatHistory.length === 0 && heygenApiKey ? (
          // Case 1: Initial view with Heygen - Mic widget below video
          <Fade in timeout={500}>
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
                px: 3,
                pb: 3,
              }}
            >
              {/* Mic widget directly below video */}
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 1.5,
                  backgroundColor: "#FFFFFF",
                  borderRadius: "24px",
                  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
                  border: "1px solid rgba(0, 0, 0, 0.06)",
                  p: 2.5,
                  minWidth: "320px",
                  maxWidth: "400px",
                }}
              >
                {/* Microphone Button */}
                <IconButton
                  onClick={handleSpeakClick}
                  disabled={!isLoaded}
                  sx={{
                    height: "48px",
                    width: "48px",
                    backgroundColor: isRecording
                      ? "#DC2626"
                      : !isLoaded
                        ? "#CCCCCC"
                        : "#111111",
                    color: "white",
                    borderRadius: "50%",
                    position: "relative",
                    cursor: !isLoaded ? "not-allowed" : "pointer",
                    opacity: !isLoaded ? 0.6 : 1,
                    transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                    transform: !isLoaded ? "scale(0.95)" : "scale(1)",
                    "&:hover": {
                      backgroundColor: !isLoaded
                        ? "#CCCCCC"
                        : isRecording
                          ? "#B91C1C"
                          : "#222222",
                      transform: !isLoaded ? "scale(0.95)" : "scale(1.05)",
                    },
                    "&.Mui-disabled": {
                      backgroundColor: "#CCCCCC",
                      color: "white",
                    },
                    "&::before": !isRecording
                      ? {
                          content: '""',
                          position: "absolute",
                          width: "56px",
                          height: "56px",
                          borderRadius: "50%",
                          backgroundColor: "#111111",
                          opacity: 0.06,
                          animation: "subtle-pulse 3s infinite",
                        }
                      : {},
                    "&::after": isRecording
                      ? {
                          content: '""',
                          position: "absolute",
                          width: "60px",
                          height: "60px",
                          borderRadius: "50%",
                          backgroundColor: "#DC2626",
                          opacity: 0.15,
                          animation: "recording-pulse 2s infinite",
                        }
                      : {},
                    "@keyframes subtle-pulse": {
                      "0%": { transform: "scale(1)", opacity: 0.06 },
                      "50%": { transform: "scale(1.05)", opacity: 0.03 },
                      "100%": { transform: "scale(1)", opacity: 0.06 },
                    },
                    "@keyframes recording-pulse": {
                      "0%": { transform: "scale(1)", opacity: 0.15 },
                      "50%": { transform: "scale(1.1)", opacity: 0.08 },
                      "100%": { transform: "scale(1.2)", opacity: 0 },
                    },
                  }}
                >
                  {isRecording ? (
                    <RecordIcon sx={{ fontSize: "20px" }} />
                  ) : (
                    <Mic sx={{ fontSize: "20px" }} />
                  )}
                </IconButton>

                <Typography
                  variant="body2"
                  sx={{
                    color: isRecording
                      ? "#222222"
                      : !isLoaded
                        ? "#CCCCCC"
                        : "#817973",
                    fontSize: "14px",
                    fontFamily: "Inter, Arial, sans-serif",
                    fontWeight: 500,
                    textAlign: "center",
                    mt: 0.5,
                    transition: "color 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                >
                  {!isLoaded
                    ? "Loading..."
                    : isRecording
                      ? "Listening... Tap to stop"
                      : "Tap to start speaking"}
                </Typography>

                {!isRecording && (
                  <Fade in={isLoaded} timeout={300}>
                    <Link
                      component="button"
                      onClick={handleTypeInstead}
                      sx={{
                        color: "#817973",
                        fontSize: "12px",
                        fontFamily: "Inter, Arial, sans-serif",
                        textDecoration: "underline",
                        cursor: isLoaded ? "pointer" : "not-allowed",
                        mt: 0.5,
                        opacity: isLoaded ? 1 : 0.5,
                        pointerEvents: isLoaded ? "auto" : "none",
                        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                        "&:hover": {
                          color: isLoaded ? "#5C5652" : "#817973",
                        },
                      }}
                    >
                      Type instead
                    </Link>
                  </Fade>
                )}

                {/* Text input for Case 1 (Heygen + no chat) */}
                <Collapse in={showTextWidget} timeout={300}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      width: "280px",
                      px: 2,
                      py: 1,
                      borderRadius: "20px",
                      backgroundColor: "#F8F9FA",
                      border: "1px solid #E9E5E0",
                      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
                      minHeight: "44px",
                      mt: 1.5,
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                  >
                    <TextField
                      fullWidth
                      value={text}
                      onChange={handleTextChange}
                      onKeyPress={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="Type your message..."
                      variant="standard"
                      autoFocus
                      InputProps={{
                        disableUnderline: true,
                        sx: {
                          fontSize: "14px",
                          fontFamily: "Inter, Arial, sans-serif",
                          color: "#222222",
                          "& input::placeholder": {
                            color: "#AEA69F",
                            opacity: 1,
                          },
                        },
                      }}
                      sx={{
                        "& .MuiInputBase-root": {
                          padding: 0,
                        },
                      }}
                    />
                    <IconButton
                      size="small"
                      onClick={handleSend}
                      disabled={!text.trim()}
                      sx={{
                        color: text.trim() ? "#111111" : "#D6D1CB",
                        transition: "color 0.2s",
                        "&:hover": {
                          backgroundColor: "transparent",
                          color: text.trim() ? "#222222" : "#D6D1CB",
                        },
                        "&.Mui-disabled": {
                          color: "#D6D1CB",
                        },
                      }}
                    >
                      <ArrowUpward sx={{ fontSize: "18px" }} />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={handleCloseTextWidget}
                      sx={{
                        color: "#817973",
                        ml: -0.5,
                        transition: "color 0.2s",
                        "&:hover": {
                          backgroundColor: "transparent",
                          color: "#5C5652",
                        },
                      }}
                    >
                      <Typography sx={{ fontSize: "18px", fontWeight: 500 }}>
                        ×
                      </Typography>
                    </IconButton>
                  </Box>
                </Collapse>
              </Box>
            </Box>
          </Fade>
        ) : chatHistory.length > 0 ? (
          // Case 3 & 4: Chat view - history below video
          <>
            {/* Chat History */}
            <Fade in={true} timeout={800}>
              <Box
                sx={{
                  flex: 1,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  paddingBottom: "140px",
                  transition: "padding-bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              >
                <History history={chatHistory} latencyData={latencyData} />
              </Box>
            </Fade>
          </>
        ) : (
          // Case 2: Initial view without Heygen - Centered mic widget
          <Box sx={{ flex: 1, position: "relative" }}>
            <History history={chatHistory} latencyData={latencyData} />
          </Box>
        )}

        {/* Input Widget - Centered (only for Case 2: no Heygen, no chat) */}
        <Fade
          in={chatHistory.length === 0 && !heygenApiKey}
          timeout={500}
          unmountOnExit
        >
          <Box
            sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 10,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1.5,
                backgroundColor: "#FFFFFF",
                borderRadius: "24px",
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
                border: "1px solid rgba(0, 0, 0, 0.06)",
                p: 2.5,
                minWidth: "320px",
                maxWidth: "400px",
                transform: "scale(1)",
                transition:
                  "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              {/* Microphone Button */}
              <IconButton
                onClick={handleSpeakClick}
                disabled={!isLoaded}
                sx={{
                  height: "48px",
                  width: "48px",
                  backgroundColor: isRecording
                    ? "#DC2626"
                    : !isLoaded
                      ? "#CCCCCC"
                      : "#111111",
                  color: "white",
                  borderRadius: "50%",
                  position: "relative",
                  cursor: !isLoaded ? "not-allowed" : "pointer",
                  opacity: !isLoaded ? 0.6 : 1,
                  transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                  transform: !isLoaded ? "scale(0.95)" : "scale(1)",
                  "&:hover": {
                    backgroundColor: !isLoaded
                      ? "#CCCCCC"
                      : isRecording
                        ? "#B91C1C"
                        : "#222222",
                    transform: !isLoaded ? "scale(0.95)" : "scale(1.05)",
                  },
                  "&.Mui-disabled": {
                    backgroundColor: "#CCCCCC",
                    color: "white",
                  },
                  "&::before": !isRecording
                    ? {
                        content: '""',
                        position: "absolute",
                        width: "56px",
                        height: "56px",
                        borderRadius: "50%",
                        backgroundColor: "#111111",
                        opacity: 0.06,
                        animation: "subtle-pulse 3s infinite",
                      }
                    : {},
                  "&::after": isRecording
                    ? {
                        content: '""',
                        position: "absolute",
                        width: "60px",
                        height: "60px",
                        borderRadius: "50%",
                        backgroundColor: "#DC2626",
                        opacity: 0.15,
                        animation: "recording-pulse 2s infinite",
                      }
                    : {},
                  "@keyframes subtle-pulse": {
                    "0%": { transform: "scale(1)", opacity: 0.06 },
                    "50%": { transform: "scale(1.05)", opacity: 0.03 },
                    "100%": { transform: "scale(1)", opacity: 0.06 },
                  },
                  "@keyframes recording-pulse": {
                    "0%": { transform: "scale(1)", opacity: 0.15 },
                    "50%": { transform: "scale(1.1)", opacity: 0.08 },
                    "100%": { transform: "scale(1.2)", opacity: 0 },
                  },
                }}
              >
                {isRecording ? (
                  <RecordIcon sx={{ fontSize: "20px" }} />
                ) : (
                  <Mic sx={{ fontSize: "20px" }} />
                )}
              </IconButton>

              <Typography
                variant="body2"
                sx={{
                  color: isRecording
                    ? "#222222"
                    : !isLoaded
                      ? "#CCCCCC"
                      : "#817973",
                  fontSize: "14px",
                  fontFamily: "Inter, Arial, sans-serif",
                  fontWeight: 500,
                  textAlign: "center",
                  mt: 0.5,
                  transition: "color 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              >
                {!isLoaded
                  ? "Loading..."
                  : isRecording
                    ? "Listening... Tap to stop"
                    : "Tap to start speaking"}
              </Typography>

              {!isRecording && (
                <Fade in={isLoaded} timeout={300}>
                  <Link
                    component="button"
                    onClick={handleTypeInstead}
                    sx={{
                      color: "#817973",
                      fontSize: "12px",
                      fontFamily: "Inter, Arial, sans-serif",
                      textDecoration: "underline",
                      cursor: isLoaded ? "pointer" : "not-allowed",
                      mt: 0.5,
                      opacity: isLoaded ? 1 : 0.5,
                      pointerEvents: isLoaded ? "auto" : "none",
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                      "&:hover": {
                        color: isLoaded ? "#5C5652" : "#817973",
                      },
                    }}
                  >
                    Type instead
                  </Link>
                </Fade>
              )}

              {/* Text input dropdown for center position */}
              <Collapse in={showTextWidget} timeout={300}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    width: "280px",
                    px: 2,
                    py: 1,
                    borderRadius: "20px",
                    backgroundColor: "#F8F9FA",
                    border: "1px solid #E9E5E0",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
                    minHeight: "44px",
                    mt: 1.5,
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    "&:hover": {
                      borderColor: "#D6D1CB",
                      backgroundColor: "#FFFFFF",
                    },
                    "&:focus-within": {
                      borderColor: "#AEA69F",
                      backgroundColor: "#FFFFFF",
                      boxShadow: "0 2px 12px rgba(0, 0, 0, 0.10)",
                    },
                  }}
                >
                  <TextField
                    fullWidth
                    multiline
                    maxRows={3}
                    value={text}
                    onChange={handleTextChange}
                    onKeyPress={handleTextKeyPress}
                    placeholder={!isLoaded ? "Loading..." : "Type a message..."}
                    variant="standard"
                    autoFocus
                    disabled={!isLoaded}
                    sx={{
                      "& .MuiInputBase-root": {
                        fontSize: "14px",
                        fontFamily: "Inter, Arial, sans-serif",
                        color: "#222222",
                        lineHeight: 1.4,
                        transition: "opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                        "&::before, &::after": {
                          display: "none",
                        },
                      },
                      "& .MuiInputBase-input": {
                        padding: "8px 0",
                        display: "flex",
                        alignItems: "center",
                        "&::placeholder": {
                          color: "#817973",
                          opacity: 1,
                        },
                      },
                    }}
                  />

                  {text.trim() && (
                    <Fade in={!!text.trim()} timeout={200}>
                      <IconButton
                        onClick={handleSend}
                        sx={{
                          backgroundColor: "#111111",
                          color: "white",
                          borderRadius: "50%",
                          width: "32px",
                          height: "32px",
                          minWidth: "32px",
                          ml: 1,
                          "&:hover": {
                            backgroundColor: "#222222",
                          },
                          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                        }}
                      >
                        <ArrowUpward sx={{ fontSize: "16px" }} />
                      </IconButton>
                    </Fade>
                  )}

                  <IconButton
                    onClick={handleCloseTextWidget}
                    sx={{
                      height: "28px",
                      width: "28px",
                      minWidth: "28px",
                      color: "#817973",
                      ml: 0.5,
                      "&:hover": {
                        backgroundColor: "#E9E5E0",
                        color: "#5C5652",
                      },
                      transition: "all 0.2s ease-in-out",
                    }}
                  >
                    ✕
                  </IconButton>
                </Box>
              </Collapse>
            </Box>
          </Box>
        </Fade>

        {/* Bottom widget - slides up and fades in when chat starts */}
        <Slide
          direction="up"
          in={chatHistory.length > 0}
          timeout={600}
          mountOnEnter
          unmountOnExit
        >
          <Box
            sx={{
              position: "fixed",
              bottom: "24px",
              left: 0,
              right: 0,
              zIndex: 10,
              width: "100%",
              maxWidth: "800px",
              mx: "auto",
              px: 3,
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                backgroundColor: "#FFFFFF",
                borderRadius: "28px",
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
                border: "1px solid rgba(0, 0, 0, 0.06)",
                px: 2,
                py: 1.5,
                gap: 1.5,
                minHeight: "56px",
                width: "100%",
                maxWidth: "700px",
                mx: "auto",
              }}
            >
              {/* Microphone Button */}
              <IconButton
                onClick={handleSpeakClick}
                disabled={!isLoaded}
                sx={{
                  height: "40px",
                  width: "40px",
                  backgroundColor: isRecording
                    ? "#DC2626"
                    : !isLoaded
                      ? "#CCCCCC"
                      : "#111111",
                  color: "white",
                  borderRadius: "50%",
                  flexShrink: 0,
                  cursor: !isLoaded ? "not-allowed" : "pointer",
                  opacity: !isLoaded ? 0.6 : 1,
                  transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                  transform: !isLoaded ? "scale(0.95)" : "scale(1)",
                  "&:hover": {
                    backgroundColor: !isLoaded
                      ? "#CCCCCC"
                      : isRecording
                        ? "#B91C1C"
                        : "#222222",
                    transform: !isLoaded ? "scale(0.95)" : "scale(1.05)",
                  },
                  "&.Mui-disabled": {
                    backgroundColor: "#CCCCCC",
                    color: "white",
                  },
                }}
              >
                {isRecording ? (
                  <RecordIcon sx={{ fontSize: "18px" }} />
                ) : (
                  <Mic sx={{ fontSize: "18px" }} />
                )}
              </IconButton>

              {/* Content Area - Always show text input at bottom */}
              <TextField
                fullWidth
                value={text}
                onChange={handleTextChange}
                onKeyPress={handleTextKeyPress}
                placeholder={
                  !isLoaded
                    ? "Loading..."
                    : isRecording
                      ? "Listening... Tap mic to stop"
                      : "Type a message..."
                }
                variant="standard"
                disabled={!isLoaded}
                sx={{
                  flex: 1,
                  "& .MuiInputBase-root": {
                    fontSize: "16px",
                    fontFamily: "Inter, Arial, sans-serif",
                    color: "#222222",
                    transition: "opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                    "&::before, &::after": {
                      display: "none",
                    },
                  },
                  "& .MuiInputBase-input": {
                    padding: "8px 0",
                    "&::placeholder": {
                      color: isRecording ? "#DC2626" : "#817973",
                      opacity: 1,
                    },
                  },
                }}
              />

              {text.trim() && (
                <Fade in={!!text.trim()} timeout={200}>
                  <IconButton
                    onClick={handleSend}
                    sx={{
                      backgroundColor: "#111111",
                      color: "white",
                      borderRadius: "50%",
                      width: "32px",
                      height: "32px",
                      minWidth: "32px",
                      "&:hover": {
                        backgroundColor: "#222222",
                      },
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                  >
                    <ArrowUpward sx={{ fontSize: "16px" }} />
                  </IconButton>
                </Fade>
              )}
            </Box>
          </Box>
        </Slide>
      </Box>
    </>
  );
}
