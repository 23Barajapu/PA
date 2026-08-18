import * as k8s from '@kubernetes/client-node';
import { EventEmitter } from 'events';
import { ServiceName } from './types.js';
import stream from 'stream';

export interface K8sStreamerConfig {
  namespace?: string;
  gatewayPodPattern?: RegExp;
  gatePodPattern?: RegExp;
  transportPodPattern?: RegExp;
}

export class K8sLogStreamer extends EventEmitter {
  private kc: k8s.KubeConfig;
  private coreApi: k8s.CoreV1Api | null = null;
  private logExec: k8s.Log | null = null;
  private isConnected: boolean = false;
  private activeStreams: Map<string, stream.Readable | any> = new Map();
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  private namespace: string;
  private isRunning: boolean = false;

  constructor(config: K8sStreamerConfig = {}) {
    super();
    this.namespace = config.namespace || 'default';
    this.kc = new k8s.KubeConfig();

    try {
      this.kc.loadFromDefault();
      this.coreApi = this.kc.makeApiClient(k8s.CoreV1Api);
      this.logExec = new k8s.Log(this.kc);
      this.isConnected = true;
    } catch (err: any) {
      console.warn('[K8sStreamer] No valid Kubeconfig found or cluster unreachable. Running in Standalone/Mock fallback mode.');
      this.isConnected = false;
    }
  }

  getIsConnected(): boolean {
    return this.isConnected;
  }

  async start(): Promise<void> {
    if (!this.isConnected || !this.coreApi || !this.logExec) {
      return;
    }

    this.isRunning = true;
    await this.discoverAndStreamPods();

    // Periodic pod check (every 30s) for newly spawned pods
    setInterval(() => {
      if (this.isRunning) {
        this.discoverAndStreamPods().catch(err => {
          console.error('[K8sStreamer] Error discovering pods:', err?.message || err);
        });
      }
    }, 30000);
  }

  private async discoverAndStreamPods(): Promise<void> {
    if (!this.coreApi || !this.logExec) return;

    try {
      const res = await this.coreApi.listNamespacedPod({ namespace: this.namespace });
      const pods = res.items || [];

      for (const pod of pods) {
        const podName = pod.metadata?.name;
        const phase = pod.status?.phase;

        if (!podName || phase !== 'Running') continue;

        let service: ServiceName | null = null;
        if (podName.includes('gateway') || podName.includes('gw')) {
          service = 'api-gateway';
        } else if (podName.includes('gate') || podName.includes('routing')) {
          service = 'gate-service';
        } else if (podName.includes('transport') || podName.includes('swc') || podName.includes('iso')) {
          service = 'transport-core-swc';
        }

        if (service && !this.activeStreams.has(podName)) {
          this.attachPodLogStream(podName, service);
        }
      }
    } catch (err: any) {
      console.warn(`[K8sStreamer] Cannot connect to K8s API cluster: ${err?.message || err}. Switching to Mock Generator.`);
      this.isConnected = false;
      this.emit('fallback', err);
    }
  }

  private async attachPodLogStream(podName: string, service: ServiceName, retryAttempt: number = 0): Promise<void> {
    if (!this.logExec) return;

    console.log(`[K8sStreamer] Attaching log stream to pod: ${podName} (${service})`);
    const logStream = new stream.PassThrough();

    let buffer = '';
    logStream.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf-8');
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line

      for (const line of lines) {
        if (line.trim()) {
          this.emit('rawLog', {
            rawLine: line,
            podName,
            service
          });
        }
      }
    });

    logStream.on('error', (err: any) => {
      console.warn(`[K8sStreamer] Stream error for pod ${podName}:`, err?.message || err);
      this.handleStreamDisconnect(podName, service, retryAttempt);
    });

    logStream.on('end', () => {
      console.warn(`[K8sStreamer] Stream ended for pod ${podName}`);
      this.handleStreamDisconnect(podName, service, retryAttempt);
    });

    try {
      await this.logExec.log(
        this.namespace,
        podName,
        '', // container name (default)
        logStream,
        { follow: true, tailLines: 50, timestamps: true }
      );
      this.activeStreams.set(podName, logStream);
      this.emit('podConnected', { podName, service });
    } catch (err: any) {
      console.error(`[K8sStreamer] Failed to stream pod ${podName}:`, err?.message || err);
      this.handleStreamDisconnect(podName, service, retryAttempt);
    }
  }

  private handleStreamDisconnect(podName: string, service: ServiceName, retryAttempt: number): void {
    this.activeStreams.delete(podName);

    if (!this.isRunning) return;

    const delay = Math.min(1000 * Math.pow(2, retryAttempt), 30000); // Exponential backoff capped at 30s
    console.log(`[K8sStreamer] Reconnecting to pod ${podName} in ${delay}ms (attempt #${retryAttempt + 1})...`);

    if (this.reconnectTimers.has(podName)) {
      clearTimeout(this.reconnectTimers.get(podName)!);
    }

    const timer = setTimeout(() => {
      this.attachPodLogStream(podName, service, retryAttempt + 1);
    }, delay);

    this.reconnectTimers.set(podName, timer);
  }

  stop(): void {
    this.isRunning = false;
    for (const [_, timer] of this.reconnectTimers) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();
    this.activeStreams.clear();
  }
}
