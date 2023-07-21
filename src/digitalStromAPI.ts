/* eslint-disable @typescript-eslint/no-explicit-any */
import { Logging } from 'homebridge';
import https from 'https';
import axios, { AxiosInstance } from 'axios';
import { digitalStromURI } from './digitalStromURI';

class Session {
  private expiresOn!: number;
  private _sessionToken: string;

  constructor(){
    this._sessionToken = '';
  }

  public get sessionToken(): string {
    return this._sessionToken;
  }

  public resetSessionToken(sessionToken: string): void {
    this._sessionToken = sessionToken;
    this.setSessionTimeout();
  }

  public setSessionTimeout(): void {
    // default dss session timeout is 180s - set to 170s
    this.expiresOn = Session.getCurrentEpoch() + 170000;
  }

  public hasSessionToken(): boolean {
    return !!this._sessionToken;
  }

  public isSessionTokenExpired(): boolean {
    return this.expiresOn < Session.getCurrentEpoch();
  }

  public hasValidSessionToken(): boolean {
    return this.hasSessionToken() && !this.isSessionTokenExpired();
  }

  private static getCurrentEpoch(): number {
    return Math.round((new Date()).getTime()); // in ms
  }
}

export class digitalStromAPI {
  private session: Session | undefined;
  private uri: digitalStromURI;
  private axiosInstance: AxiosInstance;

  constructor(
    private dssIP: string,
    private appToken: string,
    private log: Logging,
  ) {
    this.session = new Session();
    this.uri = new digitalStromURI();

    this.axiosInstance = axios.create({
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
      baseURL: `https://${dssIP}:8080`,
    });

    this.axiosInstance.interceptors.request.use(async config => {

      if (!config.url?.includes(this.uri.login(this.appToken))) {
        this.log?.debug('Checking for valid session token');
        if (!this.session?.hasValidSessionToken()) {
          this.log?.debug('No valid session token');
          await this.getSessionToken();
        }
        config.url = (config.url!.indexOf('?') < 0 ? config.url + '?' : config.url + '&') + 'token=' + this.session?.sessionToken;
        this.log?.debug(`New uri [${config.url}]`);
      }

      return config;
    });

  }

  /**
   * Get apartment structure
   * @returns apartment structure as JSON object
   */
  public async getApartment(): Promise<any> {
    this.log?.debug('Getting apartment');
    const json = await this.newAPIrequest(this.uri.getApartment());
    return json.data;
  }

  /**
   * Get apartment status
   * @returns apartment status as JSON object
   */
  public async getApartmentStatus(): Promise<any> {
    this.log?.debug('Getting apartment status');
    const json = await this.newAPIrequest(this.uri.getApartmentStatus());
    return json.data;
  }

  /**
   * Get device status
   * @param dsuid id of device
   * @returns device status as JSON object
   */
  public async getDeviceStatus(dsuid: string): Promise<any> {
    this.log?.debug(`Getting status of device ${dsuid}`);
    const json = await this.newAPIrequest(this.uri.getDeviceStatus(dsuid));
    return json.data;
  }

  /**
   * Call scene max of device
   * @param dsuid id of device
   * @returns JSON object
   */
  public async turnOnDevice(dsuid: string): Promise<any> {
    this.log?.debug(`TurnOn device: ${dsuid}`);

    const data = await this.request(this.uri.turnOnDevice(dsuid));
    return data.result;
  }

  /**
   * Call scene min of device
   * @param dsuid id of device
   * @returns JSON object
   */
  public async turnOffDevice(dsuid: string): Promise<any> {
    this.log?.debug(`TurnOff device: ${dsuid}`);

    const data = await this.request(this.uri.turnOffDevice(dsuid));
    return data.result;
  }

  /**
   * Set the value of one or more output channels of the device
   * @param dsuid id of device
   * @param channels channels to set
   * @returns 
   */
  public async setOutputChannelValue(dsuid: string, channels: string): Promise<any> {
    this.log?.debug(`Set output ${channels} for ${dsuid}`);

    const data = await this.request(this.uri.setOutputChannelValue(dsuid, channels));
    return data.result;
  }

  /**
   * Get session token
   * @returns session token as string
   */
  public async getSessionToken(): Promise<Session | undefined> {
    this.log?.debug('Requesting new session token');

    const json = await this.request(this.uri.login(this.appToken));
    this.session!.resetSessionToken(json.result.token);
    this.log?.debug(`New session token: ${json.result.token}`);
    return this.session;
  }

  /**
   * Old dss API request
   * @param uri 
   * @returns JSON object
   */
  private async request(uri: string): Promise<any> {

    this.log?.debug(`Request [GET ${uri}]`);

    try {
      const response = await this.axiosInstance({
        url: uri,
        timeout: 10000,
      });

      this.log?.debug(`Response [GET ${uri}] - ${JSON.stringify(response.data)}`);

      if (!response.data.ok) {
        if (response.data.message === 'Application authentication failed') {
          if (uri === this.uri.login(this.appToken)) {
            this.log?.error(`Check your application token. ${response.data.message}`);
          } else {
            this.log?.debug('No valid session token');
            await this.getSessionToken();

            // retry last request
            return await this.request(uri.split('\\?token|\\&token', 2)[0]);

          }
        } else {
          this.log?.error(response.data.message);
        }
      } else {
        return response.data;
      }
    } catch (error) {
      this.log?.debug(`Error[GET ${uri}] - ${JSON.stringify(error)}`);
      this.log?.error(`A request error occurred: ${error.error}`);
    }
  }

  /**
   * New dss API request
   * @param uri 
   * @returns JSON object
   */
  private async newAPIrequest(uri: string): Promise<any> {

    this.log?.debug(`Request [GET ${uri}]`);

    try {
      const response = await this.axiosInstance({
        url: uri,
        timeout: 10000,
      });

      this.log?.debug(`Response [GET ${uri}] - ${JSON.stringify(response.data)}`);
      
      if (response.status !== 200) {
        this.log?.error(response.data.message);
      } else {
        return response.data;
      }
    } catch (error) {
      this.log?.debug(`Error[GET ${uri}] - ${JSON.stringify(error)}`);
      this.log?.error(`A request error occurred: ${error.error}`);
    }
  }

}