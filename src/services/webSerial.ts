/**
 * NAWI TRUST — Web Serial API Hardware Service
 *
 * Implements direct physical weighing-instrument connectivity via the W3C Web Serial API
 * (supported natively in Chrome, Edge, and Chromium-based browsers).
 * Connects directly to USB CDC-ACM virtual COM ports and physical RS-232 / USB adapters.
 */
import { ScaleParser, defaultScaleParser, type ScaleReading } from './scaleParser';

export interface SerialConfig {
  baudRate?: number;
  dataBits?: 7 | 8;
  stopBits?: 1 | 2;
  parity?: 'none' | 'even' | 'odd';
  flowControl?: 'none' | 'hardware';
  connectionType?: 'USB' | 'RS-232';
}

export type SerialStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'connection_lost'
  | 'error';

export interface SerialConnectionInfo {
  status: SerialStatus;
  portLabel: string;
  errorMessage?: string;
  baudRate: number;
  dataBits: number;
  parity: string;
  stopBits: number;
}

// Local Web Serial API interfaces (compatible with browser DOM)
interface SerialPortInfo {
  usbVendorId?: number;
  usbProductId?: number;
}

interface SerialPortOpenOptions {
  baudRate: number;
  dataBits?: 7 | 8;
  stopBits?: 1 | 2;
  parity?: 'none' | 'even' | 'odd';
  bufferSize?: number;
  flowControl?: 'none' | 'hardware';
}

interface WebSerialPort {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open(options: SerialPortOpenOptions): Promise<void>;
  close(): Promise<void>;
  getInfo(): SerialPortInfo;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
}

interface WebSerial {
  requestPort(options?: unknown): Promise<WebSerialPort>;
  getPorts(): Promise<WebSerialPort[]>;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
}

function getWebSerial(): WebSerial | undefined {
  if (typeof navigator !== 'undefined' && 'serial' in navigator) {
    return (navigator as unknown as { serial: WebSerial }).serial;
  }
  return undefined;
}

export function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

export class WebSerialService {
  private port: WebSerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private isReading = false;
  private parser: ScaleParser;

  private currentStatus: SerialStatus = 'disconnected';
  private portLabel = 'COM / Serial';
  private lastErrorMessage?: string;

  private activeConfig: Required<SerialConfig> = {
    baudRate: 9600,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    flowControl: 'none',
    connectionType: 'USB',
  };

  private readingListeners: Set<(reading: ScaleReading) => void> = new Set();
  private statusListeners: Set<(info: SerialConnectionInfo) => void> = new Set();

  constructor(customParser?: ScaleParser) {
    this.parser = customParser || defaultScaleParser;
    this.initDisconnectListener();
  }

  private initDisconnectListener(): void {
    const serial = getWebSerial();
    if (serial && typeof serial.addEventListener === 'function') {
      serial.addEventListener('disconnect', (event: unknown) => {
        const customEvt = event as { target?: WebSerialPort; port?: WebSerialPort };
        const disconnectedPort = customEvt.port || customEvt.target;
        if (this.port && (!disconnectedPort || disconnectedPort === this.port)) {
          this.handleConnectionLost('Hardware disconnected (device unplugged).');
        }
      });
    }
  }

  public get isConnected(): boolean {
    return this.currentStatus === 'connected';
  }

  public get status(): SerialStatus {
    return this.currentStatus;
  }

  public getConnectionInfo(): SerialConnectionInfo {
    return {
      status: this.currentStatus,
      portLabel: this.portLabel,
      errorMessage: this.lastErrorMessage,
      baudRate: this.activeConfig.baudRate,
      dataBits: this.activeConfig.dataBits,
      parity: this.activeConfig.parity,
      stopBits: this.activeConfig.stopBits,
    };
  }

  public setScaleInterval(d: number): void {
    this.parser.setD(d);
  }

  public onReading(callback: (reading: ScaleReading) => void): () => void {
    this.readingListeners.add(callback);
    return () => this.readingListeners.delete(callback);
  }

  public onStatusChange(callback: (info: SerialConnectionInfo) => void): () => void {
    this.statusListeners.add(callback);
    return () => this.statusListeners.delete(callback);
  }

  private notifyStatus(): void {
    const info = this.getConnectionInfo();
    for (const listener of this.statusListeners) {
      try {
        listener(info);
      } catch (err) {
        console.error('Error in status change listener:', err);
      }
    }
  }

  private notifyReading(reading: ScaleReading): void {
    for (const listener of this.readingListeners) {
      try {
        listener(reading);
      } catch (err) {
        console.error('Error in reading listener:', err);
      }
    }
  }

  /**
   * Connect to a physical scale via Web Serial API.
   * Prompts the user with the browser port selector dialog.
   */
  public async connect(config: SerialConfig = {}): Promise<boolean> {
    const serial = getWebSerial();
    if (!serial) {
      this.currentStatus = 'error';
      this.lastErrorMessage = 'Web Serial API is not supported in this browser. Please use Chrome or Edge.';
      this.notifyStatus();
      throw new Error(this.lastErrorMessage);
    }

    // If already connected, disconnect first
    if (this.isConnected) {
      await this.disconnect();
    }

    this.activeConfig = {
      baudRate: config.baudRate ?? 9600,
      dataBits: config.dataBits ?? 8,
      stopBits: config.stopBits ?? 1,
      parity: config.parity ?? 'none',
      flowControl: config.flowControl ?? 'none',
      connectionType: config.connectionType ?? 'USB',
    };

    this.currentStatus = 'connecting';
    this.lastErrorMessage = undefined;
    this.notifyStatus();

    try {
      // Prompt user to pick physical USB/RS-232 COM port
      const port = await serial.requestPort();
      this.port = port;

      // Extract port info if available
      const info = port.getInfo();
      if (info.usbVendorId !== undefined && info.usbProductId !== undefined) {
        const vid = info.usbVendorId.toString(16).toUpperCase().padStart(4, '0');
        const pid = info.usbProductId.toString(16).toUpperCase().padStart(4, '0');
        this.portLabel = `${this.activeConfig.connectionType} (VID:0x${vid}, PID:0x${pid})`;
      } else {
        this.portLabel = `${this.activeConfig.connectionType} Port`;
      }

      // Open the serial port with the configured baud and framing
      await port.open({
        baudRate: this.activeConfig.baudRate,
        dataBits: this.activeConfig.dataBits,
        stopBits: this.activeConfig.stopBits,
        parity: this.activeConfig.parity,
        flowControl: this.activeConfig.flowControl,
      });

      this.currentStatus = 'connected';
      this.notifyStatus();

      // Start continuous background reading loop
      this.startReadingLoop();
      return true;
    } catch (err: unknown) {
      const error = err as Error;
      this.currentStatus = 'error';
      if (error.name === 'NotFoundError') {
        this.lastErrorMessage = 'Connection cancelled: No device selected.';
      } else if (error.name === 'SecurityError' || error.name === 'NotAllowedError') {
        this.lastErrorMessage = 'Access denied: Serial port permission was refused.';
      } else if (error.name === 'InvalidStateError') {
        this.lastErrorMessage = 'Port in use: The selected port is already open in another application.';
      } else {
        this.lastErrorMessage = error.message || 'Failed to open serial port.';
      }
      this.notifyStatus();
      return false;
    }
  }

  /**
   * Continuous read stream from physical instrument.
   */
  private async startReadingLoop(): Promise<void> {
    if (!this.port || !this.port.readable) {
      this.handleConnectionLost('Port readable stream unavailable.');
      return;
    }

    this.isReading = true;
    this.parser.resetHistory();
    const decoder = new TextDecoder();
    let lineBuffer = '';

    try {
      this.reader = this.port.readable.getReader();

      while (this.isReading) {
        const { value, done } = await this.reader.read();
        if (done) {
          break;
        }

        if (value) {
          lineBuffer += decoder.decode(value, { stream: true });
          const parts = lineBuffer.split(/\r\n|\r|\n/);
          // Keep uncompleted line in buffer
          lineBuffer = parts.pop() || '';

          for (const rawLine of parts) {
            const trimmed = rawLine.trim();
            if (trimmed) {
              const reading = this.parser.parse(trimmed);
              if (reading) {
                this.notifyReading(reading);
              }
            }
          }
        }
      }
    } catch (err: unknown) {
      const error = err as Error;
      if (this.isReading) {
        this.handleConnectionLost(`Connection lost: ${error.message || 'Device disconnected'}`);
      }
    } finally {
      if (this.reader) {
        try {
          this.reader.releaseLock();
        } catch {
          // ignore lock release error on teardown
        }
        this.reader = null;
      }
    }
  }

  private handleConnectionLost(message: string): void {
    this.isReading = false;
    this.currentStatus = 'connection_lost';
    this.lastErrorMessage = message;
    this.notifyStatus();
    this.cleanupPort();
  }

  private async cleanupPort(): Promise<void> {
    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch {
        // ignore
      }
      try {
        this.reader.releaseLock();
      } catch {
        // ignore
      }
      this.reader = null;
    }

    if (this.port) {
      try {
        await this.port.close();
      } catch {
        // ignore
      }
      this.port = null;
    }
  }

  /**
   * Disconnect the serial port cleanly.
   */
  public async disconnect(): Promise<void> {
    this.isReading = false;
    await this.cleanupPort();
    this.currentStatus = 'disconnected';
    this.lastErrorMessage = undefined;
    this.notifyStatus();
  }
}

export const webSerialService = new WebSerialService();
