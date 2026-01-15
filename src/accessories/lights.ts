import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import type { DigitalStromPlatform } from '../platform.js';
import type { AccessoryHandler, FunctionBlock, Output, ApartmentStatus, DeviceStatus, OutputStatus } from '../digitalStromTypes.js';


/**
 * Represents a Homebridge accessory for a digitalSTROM light device.
 * Handles state, brightness, and communication with the digitalSTROM API.
 */
export class LightPlatformAccessory implements AccessoryHandler {
  /** The Homebridge Lightbulb service */
  private service: Service;
  /** Whether this light supports brightness control */
  private hasBrightness = false;
  /** Cached target value (on/off) */
  private targetValue = 0;
  /** Cached brightness value */
  private brightness = 0;

  /**
   * Constructs a new LightPlatformAccessory.
   * @param platform The DigitalStromPlatform instance.
   * @param accessory The Homebridge PlatformAccessory instance.
   */
  constructor(
    private readonly platform: DigitalStromPlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    // Set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'DigitalSTROM')
      .setCharacteristic(this.platform.Characteristic.Model, this.accessory.context.device.attributes?.technicalName || 'Light')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.accessory.context.device.id);

    // Get the Lightbulb service if it exists, otherwise create a new one
    this.service = this.accessory.getService(this.platform.Service.Lightbulb) 
      || this.accessory.addService(this.platform.Service.Lightbulb);

    // Set the service name
    this.service.setCharacteristic(this.platform.Characteristic.Name, this.accessory.displayName);

    // Check if device supports brightness (gradual control)
    const device = this.accessory.context.device as FunctionBlock;
    const brightnessOutput = device.attributes?.outputs?.find(
      (o: Output) => o.attributes?.type === 'lightBrightness' && o.attributes?.mode === 'gradual',
    );
    this.hasBrightness = !!brightnessOutput;

    // Register handlers for the On/Off Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setOn.bind(this))
      .onGet(this.getOn.bind(this));

    // Register handlers for the Brightness Characteristic only if supported
    if (this.hasBrightness) {
      this.service.getCharacteristic(this.platform.Characteristic.Brightness)
        .onSet(this.setBrightness.bind(this))
        .onGet(this.getBrightness.bind(this));
    }

    this.platform.log.debug('LightPlatformAccessory created for:', this.accessory.displayName);
  }

  /**
   * Sets the On/Off state of the light.
   * Called by Homebridge when the user toggles the light.
   * @param value The new On/Off value (true for on, false for off).
   */
  async setOn(value: CharacteristicValue) {
    const deviceId = this.accessory.context.device.id;
    const deviceName = this.accessory.context.device.attributes?.name;
    
    try {
      if (value as boolean) {
        await this.platform.dsAPI.turnOnDevice(deviceId);
        this.platform.log.info(`${deviceName} → On`);
      } else {
        await this.platform.dsAPI.turnOffDevice(deviceId);
        this.platform.log.info(`${deviceName} → Off`);
      }
    } catch (error) {
      this.platform.log.error(`Failed to set ${deviceName}:`, error);
      throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
  }

  /**
   * Gets the current On/Off state of the light.
   * Called by Homebridge to query the current state.
   * @returns True if the light is on, false otherwise.
   */
  async getOn(): Promise<CharacteristicValue> {
    // Return cached value - updates are handled by the updateState method
    return this.targetValue > 0;
  }

  /**
   * Sets the brightness of the light.
   * Called by Homebridge when the user changes brightness.
   * @param value The new brightness value (0-100).
   */
  async setBrightness(value: CharacteristicValue) {
    const deviceId = this.accessory.context.device.id;
    const deviceName = this.accessory.context.device.attributes?.name;
    
    try {
      await this.platform.dsAPI.setDeviceOutputValue(deviceId, deviceId, 'brightness', value);
      this.platform.log.info(`${deviceName} brightness → ${value}`);
    } catch (error) {
      this.platform.log.error(`Failed to set brightness for ${deviceName}:`, error);
      throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
  }

  /**
   * Gets the current brightness of the light.
   * Called by Homebridge to query the current brightness.
   * @returns The current brightness value (0-100).
   */
  async getBrightness(): Promise<CharacteristicValue> {
    // Return cached value - updates are handled by the updateState method
    return this.brightness;
  }

  /**
   * Updates the accessory state from the latest apartment status.
   * Called by the platform when apartment status changes.
   * @param apartmentStatus The latest apartment status object.
   */
  public updateState(apartmentStatus: ApartmentStatus): void {
    this.platform.log.debug(`Updating state for ${this.accessory.context.device.attributes?.name}`);

    const deviceId = this.accessory.context.device.id;
    const deviceStatus = apartmentStatus?.included?.dsDevices?.find((d: DeviceStatus) => d.id === deviceId);
    
    // Sometimes output status is not availabe (i.e. during DSS maintenance tasks)
    // Only trigger update if new status is available
    if (!deviceStatus?.attributes?.functionBlocks?.[0]?.outputs) {
      this.platform.log.debug(`No output status available for ${this.accessory.context.device.attributes?.name}`);
      return;
    }

    const brightnessOutput = deviceStatus.attributes.functionBlocks[0].outputs.find(
      (o: OutputStatus) => o.id === 'brightness',
    );

    if (brightnessOutput) {
      const targetValue = brightnessOutput.targetValue;
      this.targetValue = (typeof targetValue === 'number' && !isNaN(targetValue)) ? Math.round(targetValue) : 0;
      this.service.updateCharacteristic(this.platform.Characteristic.On, this.targetValue > 0);

      if (this.hasBrightness) {
        const value = brightnessOutput.value;
        this.brightness = (typeof value === 'number' && !isNaN(value)) ? Math.round(value) : 0;
        this.service.updateCharacteristic(this.platform.Characteristic.Brightness, this.brightness);
      }
    }
  }
}
