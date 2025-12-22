import websocket from 'websocket';
import type { client, connection, Message } from 'websocket';
import { Logging } from 'homebridge';

type WsClient = client;
type WsConnection = connection;

const { client: WsClientConstructor } = websocket;

/**
 * Handles WebSocket communication with the digitalSTROM server for real-time notifications.
 * Supports connection management, heartbeat, reconnection, and message listeners.
 */
export default class WebSocketClient {
  /** WebSocket client instance */
  private client: WsClient | null = null;
  /** WebSocket connection instance */
  private connection: WsConnection | null = null;
  /** Registered message listeners */
  private listeners: Array<{id: string; callback: (msg: { command: string; payload?: string }) => unknown}> = [];
  /** Whether a connection attempt is in progress */
  private isConnecting = false;
  /** Heartbeat interval timer */
  private heartbeatInterval: NodeJS.Timeout | null = null;
  /** Current retry count for reconnection */
  private retryCount = 0;
  /** Maximum number of reconnection attempts */
  private readonly maxRetries = 10;
  private readonly BASE_RETRY_DELAY = 1000; // 1 second
  private readonly MAX_RETRY_DELAY = 30000; // 30 seconds
  /** Heartbeat interval in milliseconds */
  private readonly HEARTBEAT_INTERVAL = 120 * 1000;
  /** Ping timeout in milliseconds */
  private readonly PING_TIMEOUT = 5000;

  private readonly WS_PORT = 8090;

  /**
   * Constructs a new WebSocketClient.
   * @param socketHost The host address for the WebSocket server.
   * @param log Logger instance for debug and error output.
   */
  constructor(
    private readonly socketHost: string,
    private readonly log: Logging,
  ) {
    this.log.debug('Inside websocketClient Class');
    this.connect();
  }

  /**
   * Establishes a connection to the WebSocket server and manages reconnection logic.
   * @param callback Optional callback for connection result or errors.
   */
  private connect(callback?: (err?: Error) => void): void {
    if (this.isConnecting) {
      this.log.debug('Already connecting, skipping...');
      return;
    }
    if (this.retryCount >= this.maxRetries) {
      this.log.error('Max retries reached, stopping reconnection server attempts');
      if (callback) {
        callback(new Error('Max retries reached'));
      }
      return;
    }

    this.isConnecting = true;
    this.client = new WsClientConstructor();

    this.client.on('connect', (connection: WsConnection) => {
      this.log.debug('WebSocket Connection established!');
      this.isConnecting = false;
      this.retryCount = 0; // reset retries on success
      this.connection = connection;

      // Clear any existing heartbeat interval
      if (this.heartbeatInterval) {
        this.log.debug('Clearing existing heartbeat interval');
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }

      this.connection.on('error', (error: Error) => {
        this.log.error('WS Connection Error:', error.message);
        if (callback) {
          callback(error);
        }
        this.connection?.close();
        this.connection = null; // clear stale connection
        this.client = null; // clear stale client
        setTimeout(() => this.connect(), 1000);
      });

      this.connection.on('close', () => {
        this.log.debug('WebSocket Connection closed by Server');
        if (this.heartbeatInterval) {
          this.log.debug('Clearing heartbeat interval on close');
          clearInterval(this.heartbeatInterval);
          this.heartbeatInterval = null;
        }
        this.connection = null; // clear stale connection
        this.client = null; // clear stale client
        this.isConnecting = false;
        if (callback) {
          callback(new Error('Connection closed by server'));
        }
        this.connect();
      });

      this.connection.on('pong', () => {
        this.log.debug('WebSocket is alive');
      });

      this.connection.on('message', (message: Message) => {
        try {
          if (message.type !== 'utf8') {
            throw new Error('Cannot handle binary WebSocket messages...');
          }
          this.handleMessage(message.utf8Data as string);
        } catch (err) {
          this.log.error('Error handling message:', err as Error);
        }
      });

      // Activate websocket notifications on the server
      this.sendWebSocketCommand('{"protocol":"json","version":"1"}');

      // Set up a new heartbeat interval
      this.heartbeatInterval = setInterval(async () => {
        this.log.debug('WS heartbeat sent');
        try {
          await this.ping();
        } catch (err) {
          this.log.error('Heartbeat failed, reconnecting...');
          this.connection?.close();
          this.connect();
        }
      }, this.HEARTBEAT_INTERVAL);

      if (callback) {
        callback();
      }
    });

    this.client.on('connectFailed', (err: Error) => {
      this.isConnecting = false;
      if (callback) {
        callback(err);
      }
      this.retryCount++;
      this.log.error(`WS Connection failed! Retry ${this.retryCount}/${this.maxRetries}`);
      this.log.error(err.message);

      // Exponential backoff with max delay
      const delay = Math.min(
        this.BASE_RETRY_DELAY * Math.pow(2, this.retryCount - 1),
        this.MAX_RETRY_DELAY,
      );
      
      this.log.debug(`Retrying in ${delay}ms...`);
      setTimeout(() => this.connect(), delay);
    });

    this.log.debug('Connecting to WebSocket Server...');
    const wsServerAddress = `ws://${this.socketHost}:${this.WS_PORT}/api/v1/apartment/notifications`;
    this.log.debug(`Server: ${wsServerAddress}`);
    this.client.connect(wsServerAddress);
  }

  /**
   * Closes the WebSocket connection and clears heartbeat intervals.
   */
  public close(): void {
    try {
      // Clear the heartbeat interval when explicitly closing the connection
      if (this.heartbeatInterval) {
        this.log.debug('Clearing heartbeat interval on explicit close');
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }

      this.connection?.close();
      this.connection = null; // clear reference
      this.client = null; // clear reference
    } catch (err) {
      this.log.error('Error closing connection:', err);
    }
  }

  /**
   * Adds a message listener for incoming WebSocket messages.
   * @param listenerId Unique identifier for the listener.
   * @param callback Callback function to handle messages.
   */
  public addMessageListener(listenerId: string, callback: (msg: { command: string; payload?: string }) => unknown): void {
    this.log.debug(`Adding connection listener: ${listenerId}`);
    this.listeners.push({ id: listenerId, callback });
  }

  /**
   * Removes a previously registered message listener.
   * @param listenerId Unique identifier for the listener to remove.
   */
  public removeMessageListener(listenerId: string): void {
    this.listeners = this.listeners.filter(
      (listener) => listener.id !== listenerId,
    );
  }

  /**
   * Handles and dispatches incoming WebSocket messages to registered listeners.
   * @param msg The received message string.
   */
  private handleMessage(msg: string): void {
    try {
      msg = msg.replace('\u001e', '');
      const [command, payload] = msg.split(';');
      this.log.debug('Received message: ' + JSON.stringify({ command, payload }));
      this.listeners.forEach((listener) => listener.callback({ command, payload }));
    } catch (err) {
      this.log.error('Error processing message:', err as Error);
    }
  }

  /**
   * Sends a command (and optional payload) to the WebSocket server.
   * @param command The command string to send.
   * @param payload Optional payload string.
   * @returns Promise that resolves when the message is sent.
   */
  public sendWebSocketCommand(command: string, payload = ''): Promise<void> {
    this.log.debug(`SENDING SOCKET MESSAGE: ${JSON.stringify({ command, payload } )}`);

    return new Promise<void>((resolve, reject) => {
      if (!this.connection) {
        this.connect((err) => {
          if (err) {
            reject(err);
            return;
          }
          this.sendWebSocketCommand(command, payload).then(resolve).catch(reject);
        });
        return;
      }

      this.connection.send(`${command};${payload}`, (err?: Error) => {
        if (err) {
          this.log.debug('Sending failed!');
          this.log.error(err.message);
          reject(err);
        } else {
          this.log.debug('Sending succeeded!');
          resolve();
        }
      });
    });
  }

  /**
   * Sends a ping to the WebSocket server and waits for a pong response.
   * Used for heartbeat/liveness checking.
   * @returns Promise that resolves if pong is received, rejects on timeout or error.
   */
  private ping(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.connection) {
        reject(new Error('No connection available'));
        return;
      }

      this.connection.ping(Buffer.alloc(0));
      let pong = false;
      this.connection.once('pong', () => {
        pong = true;
        resolve();
      });

      setTimeout(() => {
        if (!pong) {
          reject(new Error('Ping timeout'));
        }
      }, this.PING_TIMEOUT);
    });
  }

}