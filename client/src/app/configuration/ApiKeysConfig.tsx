import { Visibility, VisibilityOff } from "@mui/icons-material";
import {
  Box,
  IconButton,
  InputAdornment,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";

interface ApiKeysConfigProps {
  inworldApiKey: string;
  assemblyAiApiKey: string;
  heygenApiKey: string;
  showInworldKey: boolean;
  showAssemblyAiKey: boolean;
  showHeygenKey: boolean;
  onInworldApiKeyChange: (value: string) => void;
  onAssemblyAiApiKeyChange: (value: string) => void;
  onHeygenApiKeyChange: (value: string) => void;
}

export const ApiKeysConfig = (props: ApiKeysConfigProps) => {
  const {
    inworldApiKey,
    assemblyAiApiKey,
    heygenApiKey,
    showInworldKey,
    showAssemblyAiKey,
    showHeygenKey,
    onInworldApiKeyChange,
    onAssemblyAiApiKeyChange,
    onHeygenApiKeyChange,
  } = props;

  const [showInworldPassword, setShowInworldPassword] = useState(false);
  const [showAssemblyAiPassword, setShowAssemblyAiPassword] = useState(false);
  const [showHeygenPassword, setShowHeygenPassword] = useState(false);

  // Check if any keys need to be entered
  const hasVisibleKeys = showInworldKey || showAssemblyAiKey || showHeygenKey;

  if (!hasVisibleKeys) {
    return null;
  }

  return (
    <Box sx={{ mb: 4 }}>
      <Typography
        variant="h6"
        sx={{
          mb: 2,
          color: "#111111",
          fontSize: "18px",
          fontWeight: 600,
          fontFamily: "Inter, Arial, sans-serif",
        }}
      >
        API Keys Configuration
      </Typography>

      <Paper
        sx={{
          borderRadius: "16px",
          backgroundColor: "#FFFFFF",
          border: "1px solid #E9E5E0",
          overflow: "hidden",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
          p: 3,
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {showInworldKey && (
            <Box>
              <TextField
                fullWidth
                type={showInworldPassword ? "text" : "password"}
                placeholder="Enter your Inworld API key"
                value={inworldApiKey}
                onChange={(e) => onInworldApiKeyChange(e.target.value)}
                variant="outlined"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={() => setShowInworldPassword(!showInworldPassword)}
                        edge="end"
                        size="small"
                      >
                        {showInworldPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontFamily: "Inter, Arial, sans-serif",
                    "& fieldset": {
                      borderColor: "#E9E5E0",
                    },
                    "&:hover fieldset": {
                      borderColor: "#D6D1CB",
                    },
                    "&.Mui-focused fieldset": {
                      borderColor: "#AEA69F",
                    },
                  },
                }}
              />
              <Typography
                variant="caption"
                sx={{
                  mt: 0.5,
                  display: "block",
                  color: "#817973",
                  fontSize: "12px",
                  fontFamily: "Inter, Arial, sans-serif",
                }}
              >
                Get your API key from{" "}
                <a
                  href="https://platform.inworld.ai/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#0C6B4D", textDecoration: "none" }}
                >
                  Inworld Portal
                </a>
              </Typography>
            </Box>
          )}

          {showAssemblyAiKey && (
            <Box>
              <TextField
                fullWidth
                type={showAssemblyAiPassword ? "text" : "password"}
                placeholder="Enter your Assembly.AI API key"
                value={assemblyAiApiKey}
                onChange={(e) => onAssemblyAiApiKeyChange(e.target.value)}
                variant="outlined"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={() =>
                          setShowAssemblyAiPassword(!showAssemblyAiPassword)
                        }
                        edge="end"
                        size="small"
                      >
                        {showAssemblyAiPassword ? (
                          <VisibilityOff />
                        ) : (
                          <Visibility />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontFamily: "Inter, Arial, sans-serif",
                    "& fieldset": {
                      borderColor: "#E9E5E0",
                    },
                    "&:hover fieldset": {
                      borderColor: "#D6D1CB",
                    },
                    "&.Mui-focused fieldset": {
                      borderColor: "#AEA69F",
                    },
                  },
                }}
              />
              <Typography
                variant="caption"
                sx={{
                  mt: 0.5,
                  display: "block",
                  color: "#817973",
                  fontSize: "12px",
                  fontFamily: "Inter, Arial, sans-serif",
                }}
              >
                Get your API key from{" "}
                <a
                  href="https://www.assemblyai.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#0C6B4D", textDecoration: "none" }}
                >
                  Assembly.AI
                </a>
              </Typography>
            </Box>
          )}

          {showHeygenKey && (
            <Box>
              <TextField
                fullWidth
                type={showHeygenPassword ? "text" : "password"}
                placeholder="Enter your HeyGen Live Avatar API key"
                value={heygenApiKey}
                onChange={(e) => onHeygenApiKeyChange(e.target.value)}
                variant="outlined"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={() => setShowHeygenPassword(!showHeygenPassword)}
                        edge="end"
                        size="small"
                      >
                        {showHeygenPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontFamily: "Inter, Arial, sans-serif",
                    "& fieldset": {
                      borderColor: "#E9E5E0",
                    },
                    "&:hover fieldset": {
                      borderColor: "#D6D1CB",
                    },
                    "&.Mui-focused fieldset": {
                      borderColor: "#AEA69F",
                    },
                  },
                }}
              />
              <Typography
                variant="caption"
                sx={{
                  mt: 0.5,
                  display: "block",
                  color: "#817973",
                  fontSize: "12px",
                  fontFamily: "Inter, Arial, sans-serif",
                }}
              >
                Required for live avatar. Get your API key from{" "}
                <a
                  href="https://www.liveavatar.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#0C6B4D", textDecoration: "none" }}
                >
                  HeyGen Platform
                </a>
              </Typography>
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  );
};

