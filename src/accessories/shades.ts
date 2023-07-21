import { Service, CharacteristicValue } from 'homebridge';
import { dssAccessory } from './base';

/**
 * An instance of this class is created for each digitalStrom light accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class ShadeAccessory extends dssAccessory {
  private service!: Service;  
  private currentPosition = 0 as number;
  private targetPosition = 0 as number;
  private positionState = 'ok' as string;

  protected configureDevice(): void {
    const device = this.accessory.context.device;

    // Set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'digitalStrom')
      .setCharacteristic(this.platform.Characteristic.Model, 'device.attributes.technicalName')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'device.id');

    // Get the LightBulb service if it exists, otherwise create a new LightBulb service
    this.service = this.accessory.getService(this.platform.Service.WindowCovering) 
      || this.accessory.addService(this.platform.Service.WindowCovering);

    // Set the service name, this is what is displayed as the default name on the Home app
    // We are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, device.attributes.name);   

    // Register required handlers for the Window Covering
    this.service.getCharacteristic(this.platform.Characteristic.CurrentPosition)
      .onGet(this.getCurrentPosition.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.PositionState)
      .onGet(this.getPositionState.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.TargetPosition)
      .onGet(this.getTargetPosition.bind(this))
      .onSet(this.setTargetPosition.bind(this));
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory
   */
  async setTargetPosition(value: CharacteristicValue) {
    this.platform.dsAPI.setOutputChannelValue(this.accessory.context.device.id, `shadePositionOutside=${value}`);
    this.platform.log.info(`${this.accessory.context.device.attributes.name} target Position -> ${value}`);
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
  async getCurrentPosition(): Promise<CharacteristicValue> {
    const status = await this.platform.dsAPI.getDeviceStatus(this.accessory.context.device.id);

    // Sometimes output status is not availabe (i.e. during DSS maintenance tasks)
    // Use cached status instead to prevent crash
    if (status.attributes.functionBlocks[0].outputs) {
      const deviceOutputShadePosition = status.attributes.functionBlocks[0].outputs.find((o) => o.id === 'shadePositionOutside');

      this.positionState = deviceOutputShadePosition.status;

      if (this.positionState === 'moving') {
        this.currentPosition = Math.round(deviceOutputShadePosition.initialValue);
      } else {
        this.currentPosition = Math.round(deviceOutputShadePosition.value);
      }       
    }

    this.platform.log.debug(`${this.accessory.context.device.attributes.name} current position is ${this.currentPosition}`);

    return this.currentPosition;
  }

  async getPositionState(): Promise<CharacteristicValue> {
    const status = await this.platform.dsAPI.getDeviceStatus(this.accessory.context.device.id);

    // Sometimes output status is not availabe (i.e. during DSS maintenance tasks)
    // Use cached status instead to prevent crash
    if (status.attributes.functionBlocks[0].outputs) {
      const deviceOutputShadePosition = status.attributes.functionBlocks[0].outputs.find((o) => o.id === 'shadePositionOutside');

      this.positionState = deviceOutputShadePosition.status;

      if (this.positionState === 'moving') {
        this.currentPosition = Math.round(deviceOutputShadePosition.initialValue);
      } else {
        this.currentPosition = Math.round(deviceOutputShadePosition.value);
      }   

      this.targetPosition = Math.round(deviceOutputShadePosition.targetValue);
      
    }

    if (this.positionState === 'moving') {
      if (this.targetPosition > this.currentPosition) {
        return this.platform.Characteristic.PositionState.INCREASING;
      } else {
        return this.platform.Characteristic.PositionState.DECREASING;
      }
    } else {
      return this.platform.Characteristic.PositionState.STOPPED;
    }
  }

  async getTargetPosition(): Promise<CharacteristicValue> {
    const status = await this.platform.dsAPI.getDeviceStatus(this.accessory.context.device.id);

    // Sometimes output status is not availabe (i.e. during DSS maintenance tasks)
    // Use cached status instead to prevent crash
    if (status.attributes.functionBlocks[0].outputs) {
      const deviceOutputShadePosition = status.attributes.functionBlocks[0].outputs.find((o) => o.id === 'shadePositionOutside');
      this.targetPosition = Math.round(deviceOutputShadePosition.targetValue);
    }

    this.platform.log.debug(`${this.accessory.context.device.attributes.name} is ${this.targetPosition}% open`);

    return this.targetPosition;
  }

  public updateState(apartmentStatus) {
    this.platform.log.debug(`Update status of ${this.accessory.context.device.attributes.name}`);

    const deviceStatus = apartmentStatus.included.dsDevices.find((d) => d.id === this.accessory.context.device.id);

    // Sometimes output status is not availabe (i.e. during DSS maintenance tasks)
    // Only trigger update if new status is available
    if (deviceStatus.attributes.functionBlocks[0].outputs) {
      const deviceOutputShadePosition = deviceStatus.attributes.functionBlocks[0].outputs.find((o) => o.id === 'shadePositionOutside');
      
      this.positionState = deviceOutputShadePosition.status;

      if (this.positionState === 'moving') {
        this.currentPosition = Math.round(deviceOutputShadePosition.initialValue);
      } else {
        this.currentPosition = Math.round(deviceOutputShadePosition.value);
      }   

      this.targetPosition = Math.round(deviceOutputShadePosition.targetValue);

      // Update Characteristics.CurrentPosition
      this.service.updateCharacteristic(this.platform.Characteristic.CurrentPosition, this.currentPosition);

      // Update Characteristics.TargetPosition
      this.service.updateCharacteristic(this.platform.Characteristic.TargetPosition, this.targetPosition);

      // Update Characteristics.PositionState
      if (this.positionState === 'moving') {
        if (this.targetPosition > this.currentPosition) {
          this.service.updateCharacteristic(this.platform.Characteristic.PositionState, 
            this.platform.Characteristic.PositionState.INCREASING);
        } else {
          this.service.updateCharacteristic(this.platform.Characteristic.PositionState, 
            this.platform.Characteristic.PositionState.DECREASING);
        }
      } else {
        this.service.updateCharacteristic(this.platform.Characteristic.PositionState,this.platform.Characteristic.PositionState.STOPPED);
      }
    }
  }
    
}