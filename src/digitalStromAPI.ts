/* eslint-disable @typescript-eslint/no-explicit-any */
import { CharacteristicValue, Logging } from 'homebridge';
import https from 'https';
import axios, { AxiosInstance, Method } from 'axios';

interface patchBody {
  op: string;
  path: string;
  value: CharacteristicValue;
}

export class digitalStromAPI {
  private axiosInstance: AxiosInstance;

  constructor(
    private dssIP: string,
    private appToken: string,
    private log: Logging,
  ) {
    this.axiosInstance = axios.create({
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
      baseURL: `https://${dssIP}:8080`,
      headers: {'Authorization': `Bearer ${this.appToken}`},
      timeout: 10000,
    });
  }

  /**
   * Get apartment structure
   * @returns apartment structure as JSON object
   */
  public async getApartment(): Promise<any> {
    this.log.debug('Getting apartment');
    const params: URLSearchParams = new URLSearchParams();
    params.set('includeAll', 'true');
    const json = await this.getApiRequest('/api/v1/apartment/', params);
    return json.data;
  }

  /**
   * Get apartment status
   * @returns apartment status as JSON object
   */
  public async getApartmentStatus(): Promise<any> {
    this.log.debug('Getting apartment status');
    const params: URLSearchParams = new URLSearchParams();
    params.set('includeAll', 'true');
    const json = await this.getApiRequest('/api/v1/apartment/status', params);
    return json.data;
  }

  /**
   * Invoke standard device scenario turnOn
   * @param dsuid id of device as string
   */
  public async turnOnDevice(dsuid: string): Promise<any> {
    this.log.debug(`TurnOn device: ${dsuid}`);
    const emptyBody = JSON.parse('{}');
    this.postApiRequest(`/api/v1/apartment/scenarios/device-${dsuid}-std.turnOn/invoke`, emptyBody);
  }

  /**
   * Invoke standard device scenario turnOff
   * @param dsuid id of device as string
   */
  public async turnOffDevice(dsuid: string): Promise<any> {
    this.log.debug(`TurnOff device: ${dsuid}`);
    const emptyBody = JSON.parse('{}');
    this.postApiRequest(`/api/v1/apartment/scenarios/device-${dsuid}-std.turnOff/invoke`, emptyBody);
  }

  /**
   * Setting output value of device
   * @param dsuid id of device as string
   * @param functionBlockId as string
   * @param outputId as string
   * @param value as CharacteristicValue
   */
  public async setDeviceOutputValue(dsuid: string, functionBlockId: string, outputId: string, value: CharacteristicValue): Promise<any> {
    this.log.debug(`Set ${outputId} to ${value} for ${dsuid}`);
    const data: patchBody[] = [
      {
        op: 'replace',
        path: `/functionBlocks/${functionBlockId}/outputs/${outputId}/value`,
        value: value,
      },
    ];
    this.patchApiRequest(`/api/v1/apartment/dsDevices/${dsuid}/status`, data);
  }

  /**
   * Generic API get request
   * @param url path as string
   * @param params search params as URLSearchParams object
   * @returns JSON response
   */
  private async getApiRequest(url: string, params: URLSearchParams) {
    const emptyBody = JSON.parse('{}');
    const response = await this.dssApiRequest('GET', url, emptyBody, params);
    return response;
  }

  /**
   * Generic API post request
   * @param url path as string
   * @param data request body as JSON object
   */
  private async postApiRequest (url: string, data: JSON) {
    const params: URLSearchParams = new URLSearchParams();
    this.dssApiRequest('POST', url, data, params);
  }

  /**
   * Generic API patch request
   * @param url path as string
   * @param data request body as 
   */
  private async patchApiRequest(url: string, data: patchBody[]) {
    const params: URLSearchParams = new URLSearchParams();
    this.dssApiRequest('PATCH', url, data, params);
  }

  /**
   * dSS API request
   * @param method request method
   * @param url path as string
   * @param data request body as JSON object
   * @param params search params as URLSearchParams object
   * @returns JSON object
   */
  private async dssApiRequest(method: Method, url: string, data: any, params: URLSearchParams): Promise<any> {

    this.log.debug(`GET request ${url}]`);

    try {
      const response = await this.axiosInstance({
        method: method,
        url: url,
        data: data,
        params: params,
      });
      
      if (response.status === 200) {
        this.log.debug(`[Response of ${method}: ${url}] ${JSON.stringify(response.data)}`);
        return response.data;
      } else if (response.status === 204) {
        this.log.debug(`[Status ${response.status}] for ${method}: ${url}`);
        return;
      } else {
        this.log.debug(`Status ${response.status} - ${response.data.message}`);
      }
    } catch (error) {
      if (error.response.status === 401) {
        // 401 Unauthorized
        this.log.error('[ERROR 401]: Unauthorized - Check your dSS AppToken');
      } else if (error.request) {
        // The request was made but no response was received
        // `error.request` is an instance of http.ClientRequest in node.js
        this.log.error(error.request);
      } else {
        // Something happened in setting up the request that triggered an Error
        this.log.error('A request error occurred:', error.message);
      }
    }
  }
}