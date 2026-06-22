import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import type { DigitalStromPlatform } from '../platform.js';
import type { AccessoryHandler, ApartmentStatus, DeviceStatus, OutputStatus } from '../types/digitalStromTypes.js';


/**
 * Represents a Homebridge accessory for a digitalSTROM shade/blind device.
 * Handles position, state, and communication with the digitalSTROM API.
 */
export class ShadePlatformAccessory implements AccessoryHandler {
  /** The Homebridge WindowCovering service */
  private service: Service;
  /** Cached current position (0-100) */
  private currentPosition = 0;
  /** Cached target position (0-100) */
  private targetPosition = 0;
  /** Cached position state ('ok' or 'moving') */
  private positionState: 'ok' | 'moving' | string = 'ok';

  /**
   * Constructs a new ShadePlatformAccessory.
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
      .setCharacteristic(this.platform.Characteristic.Model, this.accessory.context.device.attributes?.technicalName || 'Shade')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.accessory.context.device.id);

    // Get the WindowCovering service if it exists, otherwise create a new one
    this.service = this.accessory.getService(this.platform.Service.WindowCovering)
      || this.accessory.addService(this.platform.Service.WindowCovering);

    // Set the service name
    this.service.setCharacteristic(this.platform.Characteristic.Name, this.accessory.displayName);

    // Register handlers for the CurrentPosition Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.CurrentPosition)
      .onGet(this.getCurrentPosition.bind(this));

    // Register handlers for the PositionState Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.PositionState)
      .onGet(this.getPositionState.bind(this));

    // Register handlers for the TargetPosition Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.TargetPosition)
      .onSet(this.setTargetPosition.bind(this))
      .onGet(this.getTargetPosition.bind(this));

    // Register handler for HoldPosition (stop)
    this.service.getCharacteristic(this.platform.Characteristic.HoldPosition)
      .onSet(this.holdPosition.bind(this));

    this.platform.log.debug('ShadePlatformAccessory created for:', this.accessory.displayName);
  }

  /**
   * Gets the current position of the shade.
   * Called by Homebridge to query the current position.
   * @returns The cached current position (0-100).
   */
  async getCurrentPosition(): Promise<CharacteristicValue> {
    /*
     * Requesting the needed values from dSS slows down Homebridge.
     * Instead the cached value is returned and updates are handled by the updateState method on apartmentStatusChanged events.
     */
    return this.currentPosition;
  }

  /**
   * Gets the current position state of the shade.
   * Called by Homebridge to query the movement state.
   * @returns The Homebridge PositionState (INCREASING, DECREASING, or STOPPED).
   */
  async getPositionState(): Promise<CharacteristicValue> {
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

  /**
   * Sets the target position of the shade.
   * Called by Homebridge when the user changes the target position.
   * @param value The new target position (0-100).
   */
  async setTargetPosition(value: CharacteristicValue) {
    const deviceId: string = this.accessory.context.device.id;
    const deviceName = this.accessory.context.device.attributes?.name;
    const targetPosition = Number(value);

    try {
      if (targetPosition === 100) {
        await this.platform.dsAPI.invokeScenario({ context: 'applicationDevice', actionId: 'on', dsDevice: deviceId });
      } else if (targetPosition === 0) {
        await this.platform.dsAPI.invokeScenario({ context: 'applicationDevice', actionId: 'off', dsDevice: deviceId });
      } else if (this.currentPosition !== targetPosition) {
        // Set intermediate position if not already there by directly setting the output value,
        // as the on/off scenarios only support fully open/close.
        await this.platform.dsAPI.setDeviceOutputValue(deviceId, deviceId, 'shadePositionOutside', targetPosition);
      } else {
        this.platform.log.debug(`${deviceName} shade already at target position ${targetPosition}, no action taken`);
      }
      this.targetPosition = targetPosition;
      this.platform.log.info(`${deviceName} shade position → ${targetPosition}`);
    } catch (error) {
      this.platform.log.error(`Failed to set target position for shade ${deviceName}:`, error);
      throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
  }

  /**
   * Gets the target position of the shade.
   * Called by Homebridge to query the target position.
   * @returns The cached target position (0-100).
   */
  async getTargetPosition(): Promise<CharacteristicValue> {
    /*
     * Requesting the needed values from dSS slows down Homebridge.
     * Instead the cached value is returned and updates are handled by the updateState method on apartmentStatusChanged events.
     */
    return this.targetPosition;
  }

  /**
   * Stops the shade movement.
   * Called by Homebridge when the user triggers HoldPosition.
   * @param value `true` when HomeKit requests a stop; some HAP clients also send a follow-up
   *   `false` to reset the characteristic — that write is ignored to avoid a duplicate stop command.
   */
  async holdPosition(value: CharacteristicValue) {
    if (!value) {
      return;
    }
    const deviceId: string = this.accessory.context.device.id;
    const deviceName = this.accessory.context.device.attributes?.name;
    try {
      await this.platform.dsAPI.invokeScenario({ context: 'applicationDevice', actionId: 'stop', dsDevice: deviceId });
      this.platform.log.info(`${deviceName} shade stopped`);
    } catch (error) {
      this.platform.log.error(`Failed to stop shade ${deviceName}:`, error);
      throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
  }

  /**
   * Updates the accessory state from the latest apartment status.
   * Called by the platform when apartment status changes.
   * @param apartmentStatus The latest apartment status object.
   */
  public async updateState(apartmentStatus: ApartmentStatus): Promise<void> {
    this.platform.log.debug(`Update status of ${this.accessory.context.device.attributes.name}`);

    const deviceId = this.accessory.context.device.id;
    const deviceStatus = apartmentStatus?.included?.dsDevices?.find((d: DeviceStatus) => d.id === deviceId);

    // Sometimes output status is not available (i.e. during DSS maintenance tasks)
    // Only trigger update if new status is available
    if (!deviceStatus?.attributes?.functionBlocks?.[0]?.outputs) {
      this.platform.log.debug(`No output status available for ${this.accessory.context.device.attributes?.name}`);
      return;
    }
    
    const shadePositionOutput = deviceStatus.attributes.functionBlocks[0].outputs.find(
      (o: OutputStatus) => o.id === 'shadePositionOutside',
    );

    if (shadePositionOutput) {
      const rawStatus = shadePositionOutput.status ?? 'ok';
      const newPositionState = rawStatus === 'moving' ? 'moving' : 'ok';
      const newCurrentPosition = newPositionState === 'moving'
        ? Math.round(shadePositionOutput.initialValue ?? 0)
        : Math.round(shadePositionOutput.value ?? 0);
      const newTargetPosition = Math.round(shadePositionOutput.targetValue ?? 0);

      const wasMoving = this.positionState === 'moving';
      const hasReachedIntermediateTarget = wasMoving
        && newPositionState === 'ok'
        && newTargetPosition > 0
        && newTargetPosition < 100
        && newCurrentPosition === newTargetPosition;

      this.positionState = newPositionState;
      this.currentPosition = newCurrentPosition;
      this.targetPosition = newTargetPosition;

      // If we transitioned from moving to ok and landed exactly on an intermediate target,
      // send stop to avoid an empty-click fallback from raw output writes.
      if (hasReachedIntermediateTarget) {
        try {
          await this.platform.dsAPI.invokeScenario({ context: 'applicationDevice', actionId: 'stop', dsDevice: deviceId });
        } catch (error) {
          this.platform.log.warn(`Failed to send stop command after reaching intermediate target ${newTargetPosition} for shade ${deviceId}:`, error);
        }
      }

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
        this.service.updateCharacteristic(this.platform.Characteristic.PositionState, this.platform.Characteristic.PositionState.STOPPED);
      }
    }
  }
}
