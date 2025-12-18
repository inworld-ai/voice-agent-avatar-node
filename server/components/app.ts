import { stopInworldRuntime } from "@inworld/runtime";
import { VADFactory } from "@inworld/runtime/primitives/vad";
import { v4 } from "uuid";
const { validationResult } = require("express-validator");

import { parseEnvironmentVariables, getAgentConfig } from "../helpers";
import { Connection } from "../types";
import { InworldGraphWrapper } from "./graph";

export class InworldApp {
  apiKey: string;
  llmModelName: string;
  llmProvider: string;
  voiceId: string;
  vadModelPath: string;
  graphVisualizationEnabled: boolean;
  disableAutoInterruption: boolean; // Flag to disable graph-based auto-interruptions (default: false, meaning auto-interruptions are enabled)
  ttsModelId: string;
  heygenApiKey?: string;
  connections: {
    [sessionId: string]: Connection;
  } = {};

  vadClient: any;

  // Store per-session graphs for text input (each with different voiceId)
  private sessionTextGraphs: Map<string, InworldGraphWrapper> = new Map();

  // Store per-voiceId graphs for Assembly.AI STT (each with different voiceId)
  private sessionAudioGraphs: Map<string, InworldGraphWrapper> = new Map();

  // Environment configuration for lazy graph creation
  private env: ReturnType<typeof parseEnvironmentVariables>;

  promptTemplate: string;

  async initialize() {
    this.connections = {};

    // Parse the environment variables
    this.env = parseEnvironmentVariables();

    this.apiKey = this.env.apiKey;
    this.llmModelName = this.env.llmModelName;
    this.llmProvider = this.env.llmProvider;
    this.voiceId = this.env.voiceId;
    this.vadModelPath = this.env.vadModelPath;
    this.graphVisualizationEnabled = this.env.graphVisualizationEnabled;
    this.disableAutoInterruption = this.env.disableAutoInterruption;
    this.ttsModelId = this.env.ttsModelId;
    this.heygenApiKey = this.env.heygenApiKey;

    // Initialize the VAD client for Assembly.AI
    console.log("Loading VAD model from:", this.vadModelPath);
    this.vadClient = await VADFactory.createLocal({
      modelPath: this.vadModelPath,
    });
  }

  /**
   * Get or create text input graph for a session with specific voiceId.
   * Each voiceId gets its own graph instance.
   */
  async getTextGraphForSession(
    sessionId: string,
  ): Promise<InworldGraphWrapper> {
    const connection = this.connections[sessionId];
    if (!connection) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const voiceId = connection.state.voiceId || this.voiceId;

    // Check if we already have a graph for this voiceId
    let graph = this.sessionTextGraphs.get(voiceId);

    if (!graph) {
      graph = await InworldGraphWrapper.create({
        apiKey: this.apiKey,
        llmModelName: this.llmModelName,
        llmProvider: this.llmProvider,
        voiceId,
        connections: this.connections,
        graphVisualizationEnabled: this.graphVisualizationEnabled,
        disableAutoInterruption: this.disableAutoInterruption,
        ttsModelId: this.ttsModelId,
        vadClient: this.vadClient,
      });
      this.sessionTextGraphs.set(voiceId, graph);
      console.log(`Text graph created for voiceId: ${voiceId}`);
    } else {
      console.log(`Using cached text graph for voiceId: ${voiceId}`);
    }

    return graph;
  }

  /**
   * Get or create Assembly.AI audio graph for a session with specific voiceId.
   * Each voiceId gets its own graph instance.
   */
  async getGraphForSTTService(
    _sttService?: string,
    sessionId?: string,
  ): Promise<InworldGraphWrapper> {
    if (!this.env.assemblyAIApiKey) {
      throw new Error(
        `Assembly.AI STT requested but ASSEMBLY_AI_API_KEY is not configured.`,
      );
    }

    // Get voiceId for this session
    let voiceId = this.voiceId; // default
    if (sessionId && this.connections[sessionId]) {
      voiceId = this.connections[sessionId].state.voiceId || this.voiceId;
    }

    // Check if we already have an audio graph for this voiceId
    let graph = this.sessionAudioGraphs.get(voiceId);

    if (!graph) {
      console.log(`Creating Assembly.AI STT graph for voiceId: ${voiceId}`);
      graph = await InworldGraphWrapper.create({
        apiKey: this.apiKey,
        llmModelName: this.llmModelName,
        llmProvider: this.llmProvider,
        voiceId, // Use session-specific voiceId
        connections: this.connections,
        withAudioInput: true,
        graphVisualizationEnabled: this.graphVisualizationEnabled,
        disableAutoInterruption: this.disableAutoInterruption,
        ttsModelId: this.ttsModelId,
        vadClient: this.vadClient,
        useAssemblyAI: true,
        assemblyAIApiKey: this.env.assemblyAIApiKey,
      });
      this.sessionAudioGraphs.set(voiceId, graph);
      console.log(`Assembly.AI STT graph created for voiceId: ${voiceId}`);
    } else {
      console.log(`Using cached Assembly.AI STT graph for voiceId: ${voiceId}`);
    }

    return graph;
  }

  async load(req: any, res: any) {
    res.setHeader("Content-Type", "application/json");

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const agent = {
      ...req.body.agent,
      id: v4(),
    };

    const sessionId = req.query.sessionId;
    const systemMessageId = v4();
    const sttService = req.body.sttService || "assemblyai"; // Default to Assembly.AI

    // Validate STT service availability BEFORE creating session
    if (sttService !== "assemblyai") {
      return res.status(400).json({
        error: `Only Assembly.AI STT is supported`,
        availableServices: ["assemblyai"],
        requestedService: sttService,
      });
    }

    if (!this.env.assemblyAIApiKey) {
      return res.status(400).json({
        error: `Assembly.AI STT requested but ASSEMBLY_AI_API_KEY is not configured`,
        availableServices: ["assemblyai"],
        requestedService: sttService,
      });
    }

    // Get agent-specific configuration based on systemPrompt
    const agentConfig = getAgentConfig(agent.systemPrompt || "");

    console.log(
      `\n[Session ${sessionId}] Creating new session with STT: ${sttService}`,
    );
    console.log(
      `[Session ${sessionId}] Agent config: voiceId="${agentConfig.voiceId}", avatarId="${agentConfig.heygenAvatarId || "none"}"`,
    );

    this.connections[sessionId] = {
      state: {
        interactionId: systemMessageId, // Initialize with system message ID
        messages: [
          {
            role: "system",
            content: this.createSystemMessage(agent, req.body.userName),
            id: "system" + systemMessageId,
          },
        ],
        agent,
        userName: req.body.userName,
        voiceId: agentConfig.voiceId, // Use agent-specific voiceId
      },
      ws: null,
      sttService, // Store STT service choice for this session
      agentConfig, // Store agent config for later use
    };

    // Return agent info and config to client
    res.end(
      JSON.stringify({
        agent,
        agentConfig: {
          heygenAvatarId: agentConfig.heygenAvatarId,
        },
      }),
    );
  }

  private createSystemMessage(agent: any, userName: string) {
    return agent.systemPrompt.replace("{userName}", userName);
  }

  unload(req: any, res: any) {
    res.setHeader("Content-Type", "application/json");

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const sessionId = req.query.sessionId;

    // Check if connection exists before trying to set property
    if (!this.connections[sessionId]) {
      return res
        .status(404)
        .json({ error: `Session not found for sessionId: ${sessionId}` });
    }

    this.connections[sessionId].unloaded = true;

    res.end(JSON.stringify({ message: "Session unloaded" }));
  }

  shutdown() {
    this.connections = {};

    // Destroy all session text graphs
    for (const [voiceId, graph] of this.sessionTextGraphs.entries()) {
      console.log(`Destroying text graph for voiceId: ${voiceId}`);
      graph.destroy();
    }
    this.sessionTextGraphs.clear();

    // Destroy all session audio graphs
    for (const [voiceId, graph] of this.sessionAudioGraphs.entries()) {
      console.log(`Destroying audio graph for voiceId: ${voiceId}`);
      graph.destroy();
    }
    this.sessionAudioGraphs.clear();

    stopInworldRuntime();
  }
}
