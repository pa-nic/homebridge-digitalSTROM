import { client as WsClient, connection as WsConnection } from 'websocket';
import { Logging } from 'homebridge';

export default class webSocketClient {
  private client: WsClient | null = null;
  private connection: WsConnection | null = null;
  private listeners: Array<{id: string; callback: (msg: string) => unknown}> = [];
  private isConnecting = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly socketHost: string,
    private readonly log: Logging,
  ) {
    this.log.debug('Inside websocketClient Class');
    this.connect();
  }

  private connect(callback?: (err?: Error) => void) {
    if (this.isConnecting) {
      this.log.debug('Already connecting, skipping...');
      return;
    }
    this.isConnecting = true;
    this.client = new WsClient();

    this.client.on('connect', (connection: WsConnection) => {
      this.log.debug('WebSocket Connection established!');
      this.isConnecting = false;
      this.connection = connection;
      this.connection.isAlive = true;

      // Clear any existing heartbeat interval
      if (this.heartbeatInterval) {
        this.log.debug('Clearing existing heartbeat interval');
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }

      // Set up a new heartbeat interval
      this.heartbeatInterval = setInterval(async () => {
        this.log.debug('WS heartbeat sent');
        try {
          await this.ping();
        } catch (err) {
          this.log.error('Heartbeat failed, reconnecting...');
          this.connection.close();
          this.connect();
        }
      }, 120 * 1000);

      // Activate websocket notifications on the server
      this.sendWebSocketCommand('{"protocol":"json","version":"1"}');

      this.connection.on('error', (error) => {
        this.log.error('WS Connection Error');
        this.log.error(error.message);

        this.connection!.close();

        setTimeout(() => {
          this.connect();
        }, 1000);
      });

      this.connection.on('close', () => {
        this.log.debug('WebSocket Connection closed by Server');

        // Clear the heartbeat interval
        if (this.heartbeatInterval) {
          this.log.debug('Clearing heartbeat interval on close');
          clearInterval(this.heartbeatInterval);
          this.heartbeatInterval = null;
        }

        this.isConnecting = false;
        this.connect();
      });

      // this.connection.removeAllListeners('pong');
      this.connection.on('pong', () => {
        this.log.debug('WebSocket is alive');
        this.connection.isAlive = true;
      });

      this.connection.on('message', (message) => {
        try {
          if (message.type !== 'utf8') {
            throw new Error('Cannot handle binary WebSocket messages...');
          }
          this.handleMessage(message.utf8Data as string);
        } catch (err) {
          this.log.error('Error handling message:', err);
        }
      });

      if (callback) {
        callback();
      }
    });

    this.client.on('connectFailed', (err) => {
      this.isConnecting = false;
      if (callback) {
        callback(err);
      }

      this.log.error('WS Connection failed!');
      this.log.error(err.message);

      setTimeout(() => {
        this.connect();
      }, 1000);
    });

    this.log.debug('Connecting to WebSocket Server...');
    const wsServerAddress = `ws://${this.socketHost}:8090/api/v1/apartment/notifications`;
    this.log.debug(`Server: ${wsServerAddress}`);

    this.client.connect(wsServerAddress);
  }

  public close() {
    try {
      // Clear the heartbeat interval when explicitly closing the connection
      if (this.heartbeatInterval) {
        this.log.debug('Clearing heartbeat interval on explicit close');
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }

      this.connection!.close();
    } catch (err) {
      this.log.error('Error closing connection:', err);
    }
  }

  public addMessageListener(listenerId: string, callback: (msg) => unknown) {
    this.log.debug(`Adding connection listener: ${listenerId}`);
    this.listeners.push({ id: listenerId, callback });
  }

  public removeMessageListener(listenerId: string) {
    this.listeners = this.listeners.filter(
      (listener) => listener.id !== listenerId,
    );
  }

  private handleMessage(msg: string) {
    try {
      msg = msg.replace('\u001e', '');
      const [command, payload] = msg.split(';');
      this.log.debug('Received message: ' + JSON.stringify({ command, payload }));
      this.listeners.forEach((listener) => listener.callback(command));
    } catch (err) {
      this.log.error('Error processing message:', err);
    }
  }

  public sendWebSocketCommand(command: string, payload = '') {
    this.log.debug(`SENDING SOCKET MESSAGE: ${JSON.stringify({ command, payload } )}`);

    return new Promise<void>((resolve, reject) => {
      if (!this.connection) {
        this.connect((err) => {
          if (err) {
            throw new Error('No connection available');
          }

          return this.sendWebSocketCommand(command, payload);
        });
        return;
      }

      this.connection.send(`${command};${payload}`, (err) => {
        if (err) {
          this.log.debug('Sending failed!');
          this.log.error(err!.message);
          reject(err);
        } else {
          this.log.debug('Sending succeeded!');
          resolve();
        }
      });
    });
  }

  private ping() {
    return new Promise<void>((resolve, reject) => {
      try {
        this.connection.ping();
        let pong = false;
        this.connection.once('pong', () => {
          pong = true;
          resolve();
        });
        setTimeout(() => {
          if (!pong) {
            reject(new Error('timeout'));
          }
        }, 5000);
      } catch (err) {
        reject(err);
      }
    });
  }

}