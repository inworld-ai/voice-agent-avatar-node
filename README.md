# Voice Agent with Interactive Avatar

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Powered by Inworld AI](https://img.shields.io/badge/Powered_by-Inworld_AI-orange)](https://inworld.ai/runtime)
[![Documentation](https://img.shields.io/badge/Documentation-Read_Docs-blue)](https://docs.inworld.ai/docs/node/overview)
[![Model Providers](https://img.shields.io/badge/Model_Providers-See_Models-purple)](https://docs.inworld.ai/docs/models#llm)

This application demonstrates a chat agent with realistic live avatar visualization. Built on [Inworld voice-agent-node template](https://github.com/inworld-ai/voice-agent-node) and enhanced with **HeyGen Live Avatar** integration, featuring low latency real-time animated avatars, powered by Inworld AI Runtime.

## Prerequisites

- Node.js 20 or higher
- **Inworld API key** (required)
- **Assembly.AI API key** (required for speech-to-text)
- **HeyGen API key** (required for avatar visualization)

## Get Started

### Step 1: Clone the Repository

```bash
git clone https://github.com/inworld-ai/voice-agent-avatar-node
cd voice-agent-avatar-node
```

### Step 2: Configure Server Environment Variables

Copy `server/.env-sample` to `server/.env` and fill all required variables. Some variables are optional and can be left empty. In 
this case default values will be used.

Get your Inworld API key from the [Inworld Portal](https://platform.inworld.ai/).
Get your HeyGen API key from the [HeyGen Platform](https://www.liveavatar.com/).
Get your Assembly.AI API key from the [Assembly.AI](https://www.assemblyai.com/).

### Step 3: Configure Client Environment Variables (Optional)

The client supports optional environment variables to customize its behavior. Create a `.env` file in the `client` directory if you want to override defaults:

- `VITE_ENABLE_LATENCY_REPORTING` - Set to `true` to enable latency reporting in the UI (shows latency chart and latency badges on agent messages). Default: `false`
- `VITE_APP_PORT` - Server port to connect to. Default: `4000`
- `VITE_APP_LOAD_URL` - Custom load endpoint URL
- `VITE_APP_UNLOAD_URL` - Custom unload endpoint URL
- `VITE_APP_SESSION_URL` - Custom session WebSocket URL

### Step 4: Install Dependencies and Run

Install dependencies for both server and client:

```bash
# Install server dependencies
cd server
npm install

# Start the server
npm start
```

The server will start on port 4000.

```bash
# Install client dependencies
cd ../client
npm install
npm start
```

The client will start on port 3000 and should automatically open in your default browser. It's possible that port 3000 is already in use, so the next available port will be used.

### Step 5: Configure and Use the Application

1. **Define the agent settings:**
   - Enter the agent system prompt
   - Click "Create Agent"

2. **Interact with the agent:**
   - **Voice input**: For voice input, click the microphone icon to unmute yourself. Click again to mute yourself.
   - **Text input**: For text input, enter text in the input field and press Enter to send it to the agent.
   - **Avatar display**: If HeyGen API key is configured, you'll see a live avatar with lip-sync responding to the agent's speech.

## Repo Structure

```
voice-agent-avatar-node/
├── server/                       # Backend handling Inworld's LLM, STT, TTS, and HeyGen services
│   ├── components/
│   │   ├── graph.ts              # Main graph-based pipeline orchestration
│   │   ├── stt_graph.ts          # Speech-to-text graph configuration
│   │   ├── message_handler.ts    # WebSocket message handling
│   │   ├── audio_handler.ts      # Audio stream processing
│   │   └── nodes/                # Graph node implementations (STT, LLM, TTS processing)
│   ├── routes/
│   │   ├── start-heygen-session.ts   # HeyGen avatar session initialization
│   │   └── stop-heygen-session.ts    # HeyGen avatar session cleanup
│   ├── models/
│   │   └── silero_vad.onnx       # VAD model for voice activity detection
│   ├── helpers.ts                # Helper functions including voice/avatar config
│   ├── index.ts                  # Server entry point
│   ├── package.json
│   └── tsconfig.json
├── client/                       # Frontend React application
│   ├── src/
│   │   ├── app/                  # UI components (chat, configuration, shared components)
│   │   ├── App.tsx               
│   │   └── index.tsx
│   ├── public/
│   ├── package.json              
│   └── vite.config.mts
├── constants.ts
└── LICENSE
```

## Architecture

The voice agent server uses **Inworld's Graph Framework** for audio/text processing and **HeyGen Live Avatar SDK** for real-time avatar visualization.

### Pipeline Overview

```mermaid
flowchart TB
    subgraph AUDIO["AUDIO INPUT PIPELINE"]
        AudioInput[AudioInput]

        subgraph OPT1["Assembly.AI STT Pipeline"]
            AssemblyAI[AssemblyAI STT]
            TranscriptExtractor[TranscriptExtractor]
            SpeechNotif1[SpeechCompleteNotifier<br/>terminal node]

            AssemblyAI -->|interaction_complete| TranscriptExtractor
            AssemblyAI -->|interaction_complete| SpeechNotif1
            AssemblyAI -->|stream_exhausted=false<br/>loop| AssemblyAI
        end

        AudioInput --> OPT1

        TranscriptExtractor --> InteractionQueue
    end

    subgraph TEXT["TEXT PROCESSING & TTS PIPELINE"]
        TextInput[TextInput]
        DialogPrompt[DialogPromptBuilder]
        LLM[LLM]
        TextChunk[TextChunking]
        TextAgg[TextAggregator]
        TTS[TTS<br/>end]
        StateUpdate[StateUpdate]

        TextInput --> DialogPrompt
        DialogPrompt --> LLM
        LLM --> TextChunk
        LLM --> TextAgg
        TextChunk --> TTS
        TextAgg --> StateUpdate
        StateUpdate -.->|loop optional| InteractionQueue
    end

    InteractionQueue -->|text.length>0| TextInput

    style SpeechNotif1 fill:#f9f,stroke:#333,stroke-width:2px
    style TTS fill:#9f9,stroke:#333,stroke-width:2px
```

### STT Provider

The server uses **Assembly.AI** as the Speech-to-Text provider, which provides high accuracy with built-in speech segmentation.

## Troubleshooting

- If you encounter connection issues, ensure both server and client are running. Server should be running on port 4000 and client can be running on port 3000 or any other port.
- Check that your API keys are valid and properly set in the `.env` file:
  - `INWORLD_API_KEY` - Required for Inworld services
  - `ASSEMBLY_AI_API_KEY` - Required for speech-to-text
  - `HEYGEN_API_KEY` - Required for live avatar visualization

- **Avatar not showing**: Verify HeyGen API key is valid and has available quota

**Bug Reports**: [GitHub Issues](https://github.com/inworld-ai/voice-agent-avatar-node/issues)

**General Questions**: For general inquiries and support, please email us at support@inworld.ai

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

**Note**: This project uses HeyGen's services which have their own terms of service and pricing. Please review [HeyGen's Terms](https://www.heygen.com/terms) before deployment.

