/* eslint-disable @typescript-eslint/no-explicit-any */
import { CharacteristicValue, Logging } from 'homebridge';
import https from 'https';
import axios, { AxiosInstance, Method } from 'axios';
import crypto from 'crypto';

interface patchBody {
  op: string;
  path: string;
  value: CharacteristicValue;
}

export class digitalStromAPI {
  private axiosInstance!: AxiosInstance;

  constructor(
    private dssIP: string,
    private appToken: string,
    private fingerprint: string | null,
    private log: Logging,
  ) {}

  public async initialize(): Promise<void> {
    if (this.fingerprint) {
      // Remove spaces and dashes from the fingerprint string
      const cleanedFingerprint = this.fingerprint.replace(/[\s-]/g, '');
      const sha256Regex = /^[A-Fa-f0-9]{64}$/;
      let validatedCert: string | null = null;
      try {
        if (!sha256Regex.test(cleanedFingerprint)) {
          throw new Error('Invalid SHA-256 fingerprint format. Check your config.json');
        } else {
          validatedCert = await this.validateCertificate(this.dssIP, cleanedFingerprint);
        }
        if (validatedCert) {
          this.axiosInstance = axios.create({
            httpsAgent: new https.Agent({
              rejectUnauthorized: true,
              ca: validatedCert,
              checkServerIdentity: () => undefined, // Bypass hostname verification
            }),
            baseURL: `https://${this.dssIP}:8080`,
            headers: { 'Authorization': `Bearer ${this.appToken}` },
            timeout: 10000,
          });
          this.log.info('Certificate validated successfully');
        } else {
          throw new Error('Certificate validation failed.');
        }
      } catch (err) {
        throw new Error(err.message);
      }
    } else {
      this.log.info('No fingerprint provided in config. Skipping certificate validation.');
      // Create axios instance without certificate validation
      this.axiosInstance = axios.create({
        httpsAgent: new https.Agent({
          rejectUnauthorized: false,
        }),
        baseURL: `https://${this.dssIP}:8080`,
        headers: { 'Authorization': `Bearer ${this.appToken}` },
        timeout: 10000,
      });
    }
  }

  /**
   * Validate the certificate
   * @param dssIP IP address of the digitalSTROM server
   * @param fingerprint SHA-256 fingerprint of the certificate
   * @returns validated certificate as PEM string
   */
  private validateCertificate(dssIP: string, fingerprint: string): Promise<string | null> {
    const options = {
      hostname: dssIP,
      port: 8080,
      path: '/',
      method: 'GET',
      rejectUnauthorized: false,
    };

    return new Promise<string | null>((resolve, reject) => {
      const req = https.request(options, (res) => {
        const cert = (res.socket as any).getPeerCertificate().raw;
        const sha256 = crypto.createHash('sha256').update(cert).digest('hex').toLowerCase();
        if (sha256 !== fingerprint.toLowerCase()) {
          const errorMessage = 'Certificate fingerprint does not match';
          reject(new Error(errorMessage));
        } else {
          const pemCert = `-----BEGIN CERTIFICATE-----\n${cert.toString('base64')}\n-----END CERTIFICATE-----\n`;
          resolve(pemCert);
        }
      });

      req.on('error', (e) => {
        this.log.error(`Problem with request: ${e.message}`);
        reject(e);
      });

      req.end();
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
    return json?.data;
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
    return json?.data;
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
      
      if (response && response.status === 200) {
        this.log.debug(`[Response of ${method}: ${url}] ${JSON.stringify(response.data)}`);
        return response.data;
      } else if (response && response.status === 204) {
        this.log.debug(`[Status ${response.status}] for ${method}: ${url}`);
        return;
      } else if (response) {
        this.log.debug(`Status ${response.status} - ${response.data.message}`);
      } else {
        this.log.debug('No response received');
      }
    } catch (error) {
      if (error.response && error.response.status === 401) {
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