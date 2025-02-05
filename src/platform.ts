import type { API, Characteristic, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig, Service } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { digitalStromAPI } from './digitalStromAPI';
import webSocketClient from './webSocketClient';
import { dssAccessory } from './accessories/base';
import { LightAccessory } from './accessories/lights';
import { ShadeAccessory } from './accessories/shades';

type AccessoryUuid = string;

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class DigitalStromPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  /**
   * Holds all platform accessories that were loaded from cache during launch,
   * as well as accessories that have been created since launch.
   */
  private readonly accessories: PlatformAccessory[];

  protected readonly configuredAccessories: Map<AccessoryUuid, dssAccessory>;

  protected dsAppartment;

  public readonly dsAPI!: digitalStromAPI;
  private readonly webSocketClient!: webSocketClient;

  /**
   * This constructor is invoked by homebridge.
   */
  constructor(
    public readonly log: Logging,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {

    this.accessories = [];
    this.configuredAccessories = new Map();

    if (!config || !config.options) {
      this.log.info('No options found in configuration file, disabling plugin.');
      return;
    }

    const options = config.options;

    if (options.dssip === undefined || options.token === undefined) {
      this.log.error('Missing required config parameter.');
      return;
    }

    // Create digitalStromAPI instance
    this.dsAPI = new digitalStromAPI(
      options.dssip,
      options.token,
      this.log,
    );

    // Create webSocket instance
    this.webSocketClient = new webSocketClient(
      options.dssip,
      this.log,
    );

    this.log.debug('Finished initializing platform:', this.config.name);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', async () => {
      try {
        // Run the method to discover / register your devices as accessories
        await this.discoverDevices();

        // Get the current device statuses for the first time
        await this.updateAccessories();

        // WebSocket listener
        this.webSocketClient.addMessageListener('STATUS_LISTENER', (msg: string) => { 
          try {
            const json = JSON.parse(msg);
            if (json.arguments[0].type === 'apartmentStatusChanged') {
              this.log.debug('STATUS_LISTENER: Apartment status changed');
              this.updateAccessories();
            }
          } catch (error) {
            this.log.error('Error handling WebSocket message:', error);
          }
        });

      } catch (error) {
        this.log.error('Error during didFinishLaunching:', error);
      }
    });

    // When this event is fired it means the plugin fails to load or Homebridge restarts
    this.api.on('shutdown', async () => this.pluginShutdown());
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // Zero out the dss device pointer on startup. This will be set diuring device discovery.
    accessory.context.device = null;
    // Add this to the accessory array so we can track it.
    this.accessories.push(accessory);
  }

  /**
   * Register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  private async discoverDevices() {
    try {

      this.dsAppartment = await this.dsAPI.getApartment();

      const dsDevices = this.dsAppartment.included.functionBlocks;

      // Loop over the discovered devices and register each one if it has not already been registered
      for (const device of dsDevices) {

        // Generate a unique id for the accessory. This should be generated from
        // something globally unique, but constant, in this case the id/dSUID of the device
        const uuid = this.generateUUID(device.id);

        // Get type of this device
        const deviceType = this.getDeviceType(device);

        if (device.attributes.name === null) {
          // Skip device with no name
          this.log.info(`Ignoring: ${device.id}. Please set a name for the device in your DSS`);
          continue;
        }

        if (deviceType === 'notsupported') {
          // This type of accessory is not supported
          this.log.info(`Ignoring: ${device.attributes.name} of type: ${device.attributes.technicalName} is not supported`);
          continue;
        }

        // See if we already know about this accessory or if it's truly new. If it is new, add it to HomeKit.
        let accessory = this.accessories.find(x => x.UUID === uuid);

        if(!accessory) {
          accessory = new this.api.platformAccessory(device.attributes.name, uuid);

          this.log.info(`${device.attributes.name}: Adding ${deviceType} device to HomeKit.` );

          // Register this accessory with homebridge and add it to the accessory array so we can track it.
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          this.accessories.push(accessory);
        }

        // Store a copy of the device object in the `accessory.context`
        // The `context` property can be used to store any data about the accessory you may need
        accessory.context.device = device;
        accessory.context.deviceType = deviceType;

        // Create the accessory handler
        switch (accessory.context.deviceType) {
        case 'light':
          this.configuredAccessories.set(accessory.UUID, new LightAccessory(this, accessory));
          break;
        case 'shade':
          this.configuredAccessories.set(accessory.UUID, new ShadeAccessory(this, accessory));
          break;
        default:
          // We should never get here.
          this.log.error(`Unknown device of type ${device.attributes.technicalName} detected: ${device.attributes.name}.`);
          break;
        }   
        
        // Refresh the accessory cache with these values.
        this.api.updatePlatformAccessories([accessory]);
      }

      // Remove dss devices that are no longer available, but we still have in HomeKit.
      for(const oldAccessory of this.accessories) {

        const device = oldAccessory.context.device;

        // Device not present anymore in the dss system
        if(!device) {

          this.log.warn(`Device: ${oldAccessory.displayName} - is no longer available and will be removed`);
          delete this.configuredAccessories[oldAccessory.UUID];
          this.accessories.splice(this.accessories.indexOf(oldAccessory), 1);
          this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [oldAccessory]);
        }
      }
    } catch (error) {
      this.log.error('Error discovering devices:', error);
    }
  }

  /**
   * Update Homekit with latest status of digitalStrom devices
   */
  private async updateAccessories() {
    this.log.debug('Update accessories');
    
    try {
      const apartmentStatus = await this.dsAPI.getApartmentStatus();
      
      const UUIDs = [...this.configuredAccessories.keys()];
      UUIDs.forEach(uuid => {
        const accessory = this.configuredAccessories.get(uuid)!;
        accessory.updateState(apartmentStatus);
      });
    } catch (error) {
      this.log.error('Failed to update accessories:', error);
    }
  }

  /**
   * Get device type
   */
  private getDeviceType(device) {
    // Only parse devices providing a technical name
    if(device.attributes.technicalName &&
      device.attributes.technicalName !== null &&
      device.attributes.technicalName.length >= 2
    ) {
      switch (device.attributes.technicalName.substring(0,2)) {
      case 'GE':
        // Is device actually a light and not just a room/area button?
        if (Object.prototype.hasOwnProperty.call(device.attributes, 'outputs')) {
          return 'light';
        } else {
          return 'notsupported';
        }
      case 'GR':
        // Is device actually a blind / roller shutter
        if (device.attributes.outputs.find((o) => o.id === 'shadePositionOutside')) {
          return 'shade';
        } else {
          return 'notsupported';
        }
      case 'SW':
        // Is device actually a light and not just a room/area button?
        if (device.attributes.technicalName === 'SW-KL200' && Object.prototype.hasOwnProperty.call(device.attributes, 'outputs')) {
          return 'light';
        } else {
          return 'notsupported';
        }
      default:
        return 'notsupported';
      }
    } else {
      return 'notsupported';
    }
  }

  /**
   * Generate UUID
   */
  private get generateUUID(): (BinaryLike) => string {
    return this.api.hap.uuid.generate;
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
