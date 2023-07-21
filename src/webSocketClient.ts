import {client as WsClient, connection as WsConnection} from 'websocket';
import { Logger } from 'homebridge';

export default class webSocketClient {
  private client: WsClient | null = null;
  private connection: WsConnection | null = null;
  private listeners: Array<{id: string; callback: (msg: string) => unknown}> = [];

  constructor(
    private readonly socketHost: string,
    private readonly log?: Logger,
  ) {
    this.log?.debug('Inside websocketClient Class');
    this.connect();
  }

  private connect(callback?: (err?: Error) => void) {
    this.client = new WsClient();

    this.client.on('connect', (connection: WsConnection) => {
      this.log?.debug('WebSocket Connection established!');
      this.connection = connection;

      this.connection.on('error', (error) => {
        this.log?.error('WS Connection Error');
        this.log?.error(error.message);

      this.connection!.close();

      setTimeout(() => {
        this.connect();
      }, 1000);
      });

      this.connection.on('close', () => {
        this.log?.debug('WebSocket Connection closed by Server');
        this.connect();
      });

      this.connection.on('message', (message) => {
        if (message.type !== 'utf8') {
          throw new Error('Cannot handle binary WebSocket messages...');
        }

        this.handleMessage(message.utf8Data as string);
      });

      if (callback) {
        callback();
      }
    });

    this.client.on('connectFailed', (err) => {
      if (callback) {
        callback(err);
      }

      this.log?.error('WS Connection failed!');
      this.log?.error(err.message);

      setTimeout(() => {
        this.connect();
      }, 1000);
    });

    this.log?.debug('Connecting to WebSocket Server...');
    const wsServerAddress = `ws://${this.socketHost}:8090/api/v1/apartment/notifications`;
    this.log?.debug(`Server: ${wsServerAddress}`);

    this.client.connect(wsServerAddress);
  }

  public addMessageListener(listenerId: string, callback: (msg) => unknown) {
    this.log?.debug(`Adding connection listener: ${listenerId}`);
    this.listeners.push({id: listenerId, callback});
  }

  public removeMessageListener(listenerId: string) {
    this.listeners = this.listeners.filter(
      (listener) => listener.id !== listenerId,
    );
  }

  private handleMessage(msg: string) {
    const [command, payload] = msg.split(';');
    this.log?.debug('Received message: ' + JSON.stringify({command, payload}));
    this.listeners.forEach((listener) => listener.callback(command));
  }

  public sendWebSocketCommand(command: string, payload = '') {
    this.log?.debug(`SENDING SOCKET MESSAGE: ${JSON.stringify({command, payload})}`);

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
          this.log?.debug('Sending failed!');
          this.log?.error(err!.message);
          reject(err);
        } else {
          this.log?.debug('Sending succeeded!');
          resolve();
        }
      });
    });
  }
}