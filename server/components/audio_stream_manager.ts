import { AudioChunkData } from "../types";

/**
 * Manages a stream of audio chunks that can be fed asynchronously
 * as data arrives from websocket connections.
 *
 * This allows the graph to consume audio in a streaming fashion
 * rather than executing once per chunk.
 */

// Type for plain audio objects expected by the framework
type PlainAudioChunk = {
  type: "Audio";
  data: { data: Buffer; sampleRate: number };
};

export class AudioStreamManager {
  private queue: PlainAudioChunk[] = [];
  private waitingResolvers: Array<
    (value: IteratorResult<PlainAudioChunk>) => void
  > = [];
  private ended = false;

  /**
   * Add an audio chunk to the stream
   */
  pushChunk(chunk: AudioChunkData): void {
    if (this.ended) {
      return;
    }

    // Convert data to Buffer for framework expectations
    let bufferData: Buffer;
    if (Buffer.isBuffer(chunk.data)) {
      bufferData = chunk.data;
    } else if (chunk.data instanceof Float32Array) {
      bufferData = Buffer.from(chunk.data.buffer, chunk.data.byteOffset, chunk.data.byteLength);
    } else {
      // number[] - convert via Float32Array
      bufferData = Buffer.from(new Float32Array(chunk.data).buffer);
    }

    // Create plain audio object matching framework expectations
    const audioData: PlainAudioChunk = {
      type: "Audio",
      data: {
        data: bufferData,
        sampleRate: chunk.sampleRate,
      },
    };

    // If there are waiting consumers, resolve immediately
    if (this.waitingResolvers.length > 0) {
      const resolve = this.waitingResolvers.shift()!;
      resolve({ value: audioData, done: false });
    } else {
      // Otherwise, queue the chunk
      this.queue.push(audioData);
    }
  }

  /**
   * Mark the stream as ended
   */
  end(): void {
    console.log("[AudioStreamManager] Ending stream");
    this.ended = true;
    // Resolve all waiting consumers with done: true
    while (this.waitingResolvers.length > 0) {
      const resolve = this.waitingResolvers.shift()!;
      resolve({ value: undefined as any, done: true });
    }
  }

  /**
   * Create an async generator that consumes from this stream
   */
  async *createStream(): AsyncGenerator<PlainAudioChunk> {
    while (true) {
      // If we have queued chunks, yield them immediately
      if (this.queue.length > 0) {
        const chunk = this.queue.shift()!;
        yield chunk;
        continue;
      }

      // If stream has ended and queue is empty, we're done
      if (this.ended) {
        console.log("[AudioStreamManager] Stream ended, queue is empty");
        break;
      }

      // Wait for next chunk
      const result = await new Promise<IteratorResult<PlainAudioChunk>>(
        (resolve) => {
          this.waitingResolvers.push(resolve);
        },
      );

      if (result.done) {
        console.log("[AudioStreamManager] Stream ended, result is done");
        break;
      }

      yield result.value;
    }
  }

  /**
   * Check if the stream has ended
   */
  isEnded(): boolean {
    return this.ended;
  }

  /**
   * Get the number of queued chunks
   */
  getQueueLength(): number {
    return this.queue.length;
  }
}
