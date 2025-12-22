import axios, { AxiosInstance } from 'axios';
import type { ApiResponse } from './digitalStromTypes.js';
import https from 'https';
import crypto from 'crypto';
import { TLSSocket } from 'tls';
import { Logger, CharacteristicValue } from 'homebridge';

/**
 * Provides methods to interact with the digitalSTROM API, including authentication,
 * certificate validation, device control, and apartment status retrieval.
 */
export class digitalStromAPI {
  /** Axios instance for HTTP requests */
  private readonly axios: AxiosInstance;
  /** digitalSTROM server IP address */
  private readonly dssIP: string;
  /** Logger instance */
  private readonly log: Logger;
  /** API token */
  private readonly token: string;
  /** Whether to disable certificate validation */
  private readonly disableCertValidation: boolean;
  /** Certificate fingerprint for validation */
  private readonly fingerprint: string;

  private readonly DSS_API_PORT = 8080;
  private readonly REQUEST_TIMEOUT = 10000; // 10 seconds

  /**
   * Constructs a new digitalStromAPI instance.
   * @param dssIP The digitalSTROM server IP address.
   * @param token The API token.
   * @param fingerprint The certificate fingerprint (SHA-256) or null.
   * @param disableCertValidation Whether to disable certificate validation.
   * @param log Logger instance.
   */
  constructor(dssIP: string, token: string, fingerprint: string | null, disableCertValidation: boolean, log: Logger) {
    if (!dssIP || dssIP.trim() === '') {
      throw new Error('dssIP cannot be empty or undefined');
    }
    this.dssIP = dssIP;
    this.fingerprint = fingerprint || '';
    this.token = token;
    this.disableCertValidation = disableCertValidation;
    this.log = log;

    // Create axios instance with base configuration
    this.axios = axios.create({
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
      baseURL: `https://${this.dssIP}:${this.DSS_API_PORT}`,
      headers: { 'Authorization': `Bearer ${this.token}` },
      timeout: this.REQUEST_TIMEOUT,
    });

    // Add request interceptor to include token
    this.axios.interceptors.request.use((config) => {
      if (config.params) {
        config.params.token = this.token;
      } else {
        config.params = { token: this.token };
      }
      return config;
    });

    // Add response interceptor for error handling
    this.axios.interceptors.response.use(
      (response) => response,
      (error) => {
        this.log.error('API request failed:', error.message);
        throw error;
      },
    );
  }

  /**
   * Initialize the API connection with certificate validation.
   * Call this after instantiation to validate the certificate.
   * @returns True if validation is successful or skipped, false otherwise.
   */
  async initializeValidation(): Promise<boolean> {
    try {
      if (this.disableCertValidation !== true && this.fingerprint && this.fingerprint.trim() !== '') {
        this.log.info('Validating server certificate...');
        const pemCert = await this.validateCertificate(this.dssIP, this.fingerprint);
        
        if (pemCert) {
          // Update axios instance with validated certificate
          this.axios.defaults.httpsAgent = new https.Agent({
            ca: pemCert,
            rejectUnauthorized: true, // Now we can enforce certificate validation
          });
          this.log.info('Certificate validation successful');
          return true;
        } else {
          this.log.error('Certificate validation failed');
          return false;
        }
      } else {
        this.log.warn('No fingerprint provided in config - certificate validation skipped');
        return true; // Continue without validation if no fingerprint
      }
    } catch (error: unknown) {
      this.log.error('Failed to initialize API:', (error as Error).message ?? error);
      return false;
    }
  }

  /**
 * Retrieves the peer certificate from the DSS server.
 * @param validateFingerprint Optional fingerprint to validate against.
 * @returns Object containing certificate data and validation result.
 */
  private async retrieveCertificate(
    validateFingerprint?: string,
  ): Promise<{ pemCert: string; fingerprint: string; isValid: boolean }> {
    const options: https.RequestOptions = {
      hostname: this.dssIP,
      port: this.DSS_API_PORT,
      path: '/',
      method: 'GET',
      rejectUnauthorized: false,
      timeout: this.REQUEST_TIMEOUT,
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        try {
          const socket = res.socket as TLSSocket;
        
          if (!socket || typeof socket.getPeerCertificate !== 'function') {
            throw new Error('Not a TLS connection');
          }

          const peerCert = socket.getPeerCertificate();
        
          if (!peerCert || Object.keys(peerCert).length === 0) {
            throw new Error('No peer certificate available');
          }

          const cert = peerCert.raw;
          if (!cert || cert.length === 0) {
            throw new Error('Certificate data is empty');
          }

          const fingerprint = crypto
            .createHash('sha256')
            .update(cert)
            .digest('hex')
            .toLowerCase();

          let isValid = true;
          if (validateFingerprint) {
            const normalizedFingerprint = validateFingerprint
              .replace(/[:\s]/g, '')
              .toLowerCase();
            isValid = fingerprint === normalizedFingerprint;
          }

          const base64Cert = cert.toString('base64');
          const pemCert = this.formatPemCertificate(base64Cert);

          resolve({ pemCert, fingerprint, isValid });
        } catch (error) {
          reject(error);
        }
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  /**
 * Validates certificate against stored fingerprint.
 */
  private async validateCertificate(dssIP: string, fingerprint: string): Promise<string | null> {
    if (!/^[0-9a-f:]{95}$|^[0-9a-f]{64}$/.test(fingerprint)) {
      this.log.error('Invalid fingerprint format');
      return null;
    }

    try {
      const { pemCert, isValid } = await this.retrieveCertificate(fingerprint);
    
      if (!isValid) {
        this.log.error('Certificate fingerprint mismatch!');
        return null;
      }

      this.log.info('Certificate validation successful');
      return pemCert;
    } catch (error) {
      this.log.error('Error validating certificate:', error);
      return null;
    }
  }

  /**
   * Formats a base64 certificate string into proper PEM format.
   * PEM format requires line breaks every 64 characters.
   * @param base64Cert The base64-encoded certificate string.
   * @returns The PEM-formatted certificate string.
   */
  private formatPemCertificate(base64Cert: string): string {
    const lines: string[] = [];
    
    // Split base64 string into 64-character lines
    for (let i = 0; i < base64Cert.length; i += 64) {
      lines.push(base64Cert.substring(i, i + 64));
    }

    return [
      '-----BEGIN CERTIFICATE-----',
      ...lines,
      '-----END CERTIFICATE-----',
    ].join('\n');
  }

  /**
 * Gets certificate fingerprint without validation.
 */
  async getCertificateFingerprint(): Promise<string | null> {
    try {
      const { fingerprint } = await this.retrieveCertificate();
      const formatted = fingerprint.match(/.{2}/g)?.join(':') || fingerprint;
      this.log.debug(`Certificate SHA-256 fingerprint: ${formatted}`);
      return fingerprint;
    } catch (error) {
      this.log.error('Error retrieving certificate:', error);
      return null;
    }
  }

  /**
   * Test the connection to the digitalSTROM server.
   * @returns True if the connection is successful, false otherwise.
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.axios.get('/api/v1/apartment/dsServer');
      this.log.debug('Connection test successful:', response.data);
      return true;
    } catch (error: unknown) {
      this.log.error('Connection test failed:', (error as Error).message ?? error);
      return false;
    }
  }
  
  /**
   * Generic API POST request.
   * @param url The API endpoint URL.
   * @param data The request body data.
   * @returns The response data of type T.
   */
  async postApiRequest<T = unknown>(url: string, data: unknown): Promise<T> {
    try {
      const response = await this.axios.post<ApiResponse<T>>(url, data);
      return (response.data as { data: T }).data;
    } catch (error: unknown) {
      this.log.error(`POST request failed for ${url}:`, (error as Error).message ?? error);
      throw error;
    }
  }

  /**
   * Generic API PATCH request.
   * @param url The API endpoint URL.
   * @param data The request body data.
   * @returns The response data of type T.
   */
  async patchApiRequest<T = unknown>(url: string, data: unknown): Promise<T> {
    try {
      const response = await this.axios.patch<ApiResponse<T>>(url, data);
      return (response.data as { data: T }).data;
    } catch (error: unknown) {
      this.log.error(`PATCH request failed for ${url}:`, (error as Error).message ?? error);
      throw error;
    }
  }

  /**
   * Get apartment structure.
   * @returns Apartment structure as a JSON object of type T.
   */
  async getApartment<T = unknown>(): Promise<T> {
    this.log.debug('Getting apartment');
    try {
      const response = await this.axios.get<ApiResponse<T>>('/api/v1/apartment/', {
        params: { includeAll: 'true' },
      });
      return (response.data as { data: T }).data;
    } catch (error: unknown) {
      this.log.error('Failed to get apartment:', (error as Error).message ?? error);
      throw error;
    }
  }

  /**
   * Get apartment status.
   * @returns Apartment status as a JSON object of type T.
   */
  async getApartmentStatus<T = unknown>(): Promise<T> {
    this.log.debug('Getting apartment status');
    try {
      const response = await this.axios.get<ApiResponse<T>>('/api/v1/apartment/status', {
        params: { includeAll: 'true' },
      });
      return (response.data as { data: T }).data;
    } catch (error: unknown) {
      this.log.error('Failed to get apartment status:', (error as Error).message ?? error);
      throw error;
    }
  }
  
  /**
   * Turn on a device (POST scenario).
   * @param dsuid The device unique ID.
   * @returns The response data of type T.
   */
  async turnOnDevice<T = unknown>(dsuid: string): Promise<T> {
    this.log.debug(`TurnOn device: ${dsuid}`);
    const url = `/api/v1/apartment/scenarios/device-${dsuid}-std.turnOn/invoke`;
    const emptyBody = {};
    return this.postApiRequest<T>(url, emptyBody);
  }

  /**
   * Turn off a device (POST scenario).
   * @param dsuid The device unique ID.
   * @returns The response data of type T.
   */
  async turnOffDevice<T = unknown>(dsuid: string): Promise<T> {
    this.log.debug(`TurnOff device: ${dsuid}`);
    const url = `/api/v1/apartment/scenarios/device-${dsuid}-std.turnOff/invoke`;
    const emptyBody = {};
    return this.postApiRequest<T>(url, emptyBody);
  }

  /**
   * Set device output value (PATCH).
   * @param dsuid The device unique ID.
   * @param functionBlockId The function block ID.
   * @param outputId The output ID.
   * @param value The value to set.
   * @returns The response data of type T.
   */
  async setDeviceOutputValue<T = unknown>(
    dsuid: string,
    functionBlockId: string,
    outputId: string,
    value: CharacteristicValue,
  ): Promise<T> {
    this.log.debug(`Set ${outputId} to ${value} for ${dsuid}`);
    const url = `/api/v1/apartment/dsDevices/${dsuid}/status`;
    const data = [
      {
        op: 'replace',
        path: `/functionBlocks/${functionBlockId}/outputs/${outputId}/value`,
        value: value,
      },
    ];
    return this.patchApiRequest<T>(url, data);
  }
}