import type { API, Characteristic, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig, Service } from 'homebridge';
import { isIP } from 'net';
import type { FunctionBlock, Apartment, ApartmentStatus, PluginOptions, AccessoryHandler } from './digitalStromTypes.js';
import { DEVICE_TYPE_CONFIG } from './accessories/deviceTypes.js';
import { LightPlatformAccessory } from './accessories/lights.js';
import { ShadePlatformAccessory } from './accessories/shades.js';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';
import { digitalStromAPI } from './digitalStromAPI.js';
import webSocketClient from './webSocketClient.js';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class DigitalStromPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  /** Tracks restored cached accessories */
  public readonly accessories: Map<string, PlatformAccessory> = new Map();
  public readonly discoveredCacheUUIDs: string[] = [];

  /**
   * Stores runtime handler instances for each accessory.
   * WeakMap ensures handlers are garbage collected when accessories are removed.
   */
  private handlerMap = new WeakMap<PlatformAccessory, AccessoryHandler>();

  /** digitalSTROM API instance */
  public dsAPI!: digitalStromAPI;

  /** WebSocket client instance */
  public webSocketClient!: webSocketClient;

  /**
   * Constructs the DigitalStromPlatform.
   * @param log Logger instance from Homebridge.
   * @param config Platform configuration.
   * @param api Homebridge API.
   */
  constructor(
    public readonly log: Logging,
    public readonly config: PlatformConfig & { options?: PluginOptions },
    public readonly api: API,
  ) {
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;

    if (!config || !config.options) {
      this.log.info('No options found in configuration file, disabling plugin.');
      return;
    }

    const options = config.options;

    // Validate IP address
    if (!options.dssip || !this.isValidIPAddress(options.dssip)) {
      this.log.error(`Invalid IP address: ${options.dssip || 'undefined'}. Please provide a valid IP address.`);
      return;
    }

    // Validate token
    if (!options.token || options.token.trim() === '') {
      this.log.error('Invalid token: Please provide a valid digitalSTROM API token in your configuration.');
      return;
    }

    // Validate fingerprint format if provided
    if (options.fingerprint && !/^[0-9a-f:]{95}$|^[0-9a-f]{64}$/.test(options.fingerprint)) {
      this.log.warn('Fingerprint format may be invalid. Expected 64 hex characters or colon-separated format.');
    }

    // Initialize the digitalSTROM API
    this.dsAPI = new digitalStromAPI(
      options.dssip,
      options.token,
      options.fingerprint || null,
      options.disableCertificateValidation ?? false,
      this.log,
    );

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', async () => {
      this.log.debug('Executed didFinishLaunching callback');

      // If certificate checking is enabled and no fingerprint was provided, try to get it for the user
      if (options.disableCertificateValidation !== true && !options.fingerprint) {
        this.log.warn('No certificate fingerprint configured.');
        this.log.warn('Attempting to retrieve fingerprint for first-time setup...');
        try {
          const fingerprint = await this.dsAPI.getCertificateFingerprint();
          if (fingerprint) {
            this.log.warn('='.repeat(80));
            this.log.warn('# SAVE YOUR DSS CERTIFICATE FINGERPRINT TO YOUR DSS PLUGIN CONFIG:');
            this.log.warn('#');
            this.log.warn(`# Fingerprint: ${fingerprint}`);
            this.log.warn('#');
            this.log.warn('='.repeat(80));
            this.log.error('Fingerprint not configured yet, disabling plugin.');
            return;
          }
        } catch (error) {
          this.log.error('Could not retrieve fingerprint:', error);
        }
      }
      
      // Initialize API with certificate validation
      const initialized = await this.dsAPI.initializeValidation();
      
      if (!initialized) {
        this.log.error('Failed to initialize digitalSTROM API');
        return;
      }

      // Create webSocket instance
      this.webSocketClient = new webSocketClient(
        options.dssip,
        this.log,
      );

      // WebSocket listener
      this.webSocketClient.addMessageListener('STATUS_LISTENER', (msg: { command: string; payload?: string }) => { 
        try {
          const json = JSON.parse(msg.command);
          if (json.arguments && json.arguments[0]?.type === 'apartmentStatusChanged') {
            this.log.debug('STATUS_LISTENER: Apartment status changed');
            this.updateAccessories();
          }
        } catch (error: unknown) {
          if (error instanceof Error) {
            this.log.error(`Error handling WebSocket message: ${error.message}`);
            this.log.debug(error.stack ?? error.message);
          } else {
            this.log.error('Error handling WebSocket message: Unknown error type');
            this.log.debug(String(error));
          }
        }
      });
      
      this.log.info('digitalSTROM API initialized successfully');
      this.log.debug('Finished initializing platform:', this.config.name);
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });

    // When this event is fired it means the plugin fails to load or Homebridge restarts
    this.api.on('shutdown', async () => this.pluginShutdown());
  }

  /**
   * Invoked when Homebridge restores cached accessories from disk at startup.
   * Used to set up event handlers for characteristics and update respective values.
   * @param accessory The cached platform accessory.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache, so we can track if it has already been registered
    this.accessories.set(accessory.UUID, accessory);
  }

  /**
   * Discovers devices from the digitalSTROM API and registers them as Homebridge accessories.
   * Accessories must only be registered once; previously created accessories must not be registered again.
   */
  async discoverDevices() {
    try {
      // Test connection first
      this.log.info('Testing connection to digitalSTROM server...');
      const connected = await this.dsAPI.testConnection();
      
      if (!connected) {
        this.log.error('Failed to connect to digitalSTROM server');
        return;
      }

      this.log.info('Successfully connected to digitalSTROM server');

      // Get all devices from digitalSTROM
      this.log.info('Discovering devices...');
      const apartment = await this.dsAPI.getApartment<Apartment>();

      const devices = apartment.included?.functionBlocks ?? [];
      this.log.info(`Found ${devices.length} devices`);

      // Loop over the discovered devices and register each one if it has not already been registered
      for (const device of devices) {
        // Generate a unique id for the accessory this should be generated from
        // something globally unique, but constant, for example, the device serial
        // number or MAC address
        const uuid = this.api.hap.uuid.generate(device.id);

        // Get type of this device
        const dssDeviceType = this.getDssDeviceType(device);

        if (!device.attributes || device.attributes.name === null) {
          // Skip device with no name or undefined attributes
          this.log.info(`Ignoring: ${device.id}. Please set a name for the device in your DSS`);
          continue;
        }

        if (dssDeviceType === 'NotSupported') {
          // This type of accessory is not supported
          this.log.info(`Ignoring: ${device.attributes.name} of type: ${device.attributes.technicalName} is not supported`);
          continue;
        }

        // See if an accessory with the same uuid has already been registered and restored from
        // the cached devices we stored in the `configureAccessory` method above
        const existingAccessory = this.accessories.get(uuid);

        if (existingAccessory) {
          // The accessory already exists
          this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

          // Update the accessory context with the latest device info
          existingAccessory.context.device = device;

          // Persist the updated context to disk
          this.api.updatePlatformAccessories([existingAccessory]);

          // Create the runtime handler that makes the accessory work
          this.createAccessoryHandler(dssDeviceType, existingAccessory, device);
          
          // It is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, e.g.:
          // remove platform accessories when no longer present
          // this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
          // this.log.info('Removing existing accessory from cache:', existingAccessory.displayName);
        } else {
          // The accessory does not yet exist, so we need to create it
          this.log.info('Adding new accessory:', device.attributes.name);

          // Create a new accessory
          const accessory = new this.api.platformAccessory(device.attributes.name ?? 'Unknown Device', uuid);

          // store a copy of the device object in the `accessory.context`
          // the `context` property can be used to store any data about the accessory you may need
          accessory.context.device = device;

          // Create the runtime handler that makes the accessory work
          this.createAccessoryHandler(dssDeviceType, accessory, device);

          // Link the accessory to your platform
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }

        // push into discoveredCacheUUIDs
        this.discoveredCacheUUIDs.push(uuid);
      }

      this.log.info('Device discovery completed');
    } catch (error) {
      this.log.error('Error discovering devices:', error);
    }

    // Remove accessories from cache that are no longer present
    for (const [uuid, accessory] of this.accessories) {
      if (!this.discoveredCacheUUIDs.includes(uuid)) {
        this.log.info('Removing existing accessory from cache:', accessory.displayName);
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }
  }

  /**
   * Get device type for discovered DSS devices (functionBlocks).
   * @param device The function block to check.
   * @returns The device type as a string, or 'NotSupported'.
   */
  private getDssDeviceType(device: FunctionBlock): string {
    const technicalName = device.attributes?.technicalName;
    
    if (!technicalName || technicalName.length < 2) {
      return 'NotSupported';
    }

    const prefix = technicalName.substring(0, 2);

    // Check each device type configuration
    for (const [deviceType, config] of Object.entries(DEVICE_TYPE_CONFIG)) {
      if (config.prefixes.includes(prefix) && config.validate(device, technicalName)) {
        return deviceType;
      }
    }

    return 'NotSupported';
  }

  /**
   * Create the runtime handler for the accessory based on device type.
   * @param dssDeviceType The device type string.
   * @param accessory The platform accessory.
   * @param device The function block device.
   */
  private createAccessoryHandler(dssDeviceType: string, accessory: PlatformAccessory, device: FunctionBlock): void {
    let handler: AccessoryHandler | undefined;
    switch (dssDeviceType) {
    case 'light':
      handler = new LightPlatformAccessory(this, accessory);
      break;
    case 'shade':
      handler = new ShadePlatformAccessory(this, accessory);
      break;
    default:
      // We should never get here.
      this.log.error(`Unknown device of type ${device.attributes?.technicalName} detected: ${device.attributes?.name}.`);
      break;
    }
    if (handler) {
      this.handlerMap.set(accessory, handler);
    }
  }

  /**
   * Validate if the provided string is a valid IPv4 or IPv6 address.
   * @param ip The IP address string to validate.
   * @returns True if valid, false otherwise.
   */
  private isValidIPAddress(ip: string): boolean {
    // isIP returns 4 for IPv4, 6 for IPv6, or 0 if invalid
    return isIP(ip) !== 0;
  }

  /**
   * Update all accessories when apartment status changes.
   * Called on WebSocket apartmentStatusChanged event.
   */
  private async updateAccessories(): Promise<void> {
    if (this.accessories.size === 0) {
      this.log.debug('No accessories to update.');
      return;
    }
    this.log.debug('Update accessories');
    try {
      const apartmentStatus = await this.dsAPI.getApartmentStatus<ApartmentStatus>();

      for (const accessory of this.accessories.values()) {
        const handler = this.handlerMap.get(accessory);
        if (handler) {
          handler.updateState(apartmentStatus);
        }
      }
    } catch (error) {
      this.log.error('Failed to update accessories:', error);
    }
  }

  /**
   * Shut down plugin
   */
  private pluginShutdown() {
    if (this.webSocketClient) {
      this.webSocketClient.removeMessageListener('STATUS_LISTENER');
      this.webSocketClient.close();
    }
  }
}