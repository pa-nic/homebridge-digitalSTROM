import { Service, CharacteristicValue } from 'homebridge';
import { dssAccessory } from './base';

/**
 * An instance of this class is created for each digitalStrom light accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class LightAccessory extends dssAccessory {
  private service!: Service;  
  private hasBrightness = false as boolean;
  private targetValue = 0 as number;
  private brightness = 0 as number;

  protected configureDevice(): void {
    const device = this.accessory.context.device;
    this.hasBrightness = device.attributes.outputs.find((o) => o.id === 'brightness').attributes.mode === 'gradual';

    // Set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'digitalStrom')
      .setCharacteristic(this.platform.Characteristic.Model, 'device.attributes.technicalName')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'device.id');

    // Get the LightBulb service if it exists, otherwise create a new LightBulb service
    this.service = this.accessory.getService(this.platform.Service.Lightbulb) || this.accessory.addService(this.platform.Service.Lightbulb);

    // Set the service name, this is what is displayed as the default name on the Home app
    // We are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, device.attributes.name);

    // Each service must implement at-minimum the "required characteristics" for the given service type
    // See https://developers.homebridge.io/#/service/Lightbulb

    // Register register handlers for the On/Off Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setOn.bind(this))                 // SET - bind to the `setOn` method below
      .onGet(this.getOn.bind(this));                // GET - bind to the `getOn` method below

    // Register handlers for the Brightness Characteristic if device supports it
    if (this.hasBrightness) {
      this.service.getCharacteristic(this.platform.Characteristic.Brightness)
        .onSet(this.setBrightness.bind(this))       // SET - bind to the 'setBrightness` method below
        .onGet(this.getBrightness.bind(this));      // GET - bind to the 'getBrightness` method below
    }
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory
   */
  async setOn(value: CharacteristicValue) {

    if (value as boolean) {
      this.platform.dsAPI.turnOnDevice(this.accessory.context.device.id);
      this.platform.log.info(`${this.accessory.context.device.attributes.name} -> On`);
    } else {
      this.platform.dsAPI.turnOffDevice(this.accessory.context.device.id);
      this.platform.log.info(`${this.accessory.context.device.attributes.name} -> Off`);
    }
  }

  async setBrightness(value: CharacteristicValue) {
    this.platform.dsAPI.setOutputChannelValue(this.accessory.context.device.id, `brightness=${value}`);
    this.platform.log.info(`${this.accessory.context.device.attributes.name} brightness -> ${value}`);
  }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory
   *
   * GET requests should return as fast as possbile. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   *
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.
   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   * 
   * If you need to return an error to show the device as "Not Responding" in the Home app:
   * throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
   */
  async getOn(): Promise<CharacteristicValue> {
  
    /* 
     * Requesting the needed values from dSS slows down Homebridge.
     * Instead the cached value is returned and updates are handled by the updateState method on apartmentStatusChanged events.
     */

    return (this.targetValue > 0);
  }

  async getBrightness(): Promise<CharacteristicValue> {
    
    /* 
     * Requesting the needed values from dSS slows down Homebridge.
     * Instead the cached value is returned and updates are handled by the updateState method on apartmentStatusChanged events.
     */

    return this.brightness;
  }

  public updateState(apartmentStatus) {
    this.platform.log.debug(`Update status of ${this.accessory.context.device.attributes.name}`);

    const deviceStatus = apartmentStatus.included.dsDevices.find((d) => d.id === this.accessory.context.device.id);

    // Sometimes output status is not availabe (i.e. during DSS maintenance tasks)
    // Only trigger update if new status is available
    if (deviceStatus.attributes.functionBlocks[0].outputs) {
      const deviceOutputBrightness = deviceStatus.attributes.functionBlocks[0].outputs.find((o) => o.id === 'brightness');
      this.targetValue = Math.round(deviceOutputBrightness.targetValue);

      // Update Characteristic.On to true if brightness > 0 otherwise false
      this.service.updateCharacteristic(this.platform.Characteristic.On, this.targetValue > 0);

      // Update Characteristic.Brightness if device supports it
      if (this.hasBrightness) {
        this.brightness = Math.round(deviceOutputBrightness.value);
        this.service.updateCharacteristic(this.platform.Characteristic.Brightness,this.brightness);
      }
    }
  }
    
}