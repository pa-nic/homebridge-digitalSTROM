import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import type { DigitalStromPlatform } from '../platform.js';
import type { AccessoryHandler, ApartmentStatus } from '../types/digitalStromTypes.js';
import { APARTMENT_SCENE_DEFINITIONS } from '../types/sceneTypes.js';


/**
 * Represents a Homebridge accessory for a digitalSTROM apartment scene button/switch.
 * Handles state and communication with the digitalSTROM API.
 */
export class ApartmentScenePlatformAccessory implements AccessoryHandler {
  /** The Homebridge Switch service */
  private service: Service;

  /** Cached current state */
  private currentState = false;

  /**
   * Constructs a new ApartmentScenePlatformAccessory.
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
    .setCharacteristic(this.platform.Characteristic.Model, 'ApartmentScene')
    .setCharacteristic(this.platform.Characteristic.SerialNumber, this.accessory.context.scene.id);

  this.service = this.accessory.getService(this.platform.Service.Switch)
    || this.accessory.addService(this.platform.Service.Switch);

  this.service.setCharacteristic(this.platform.Characteristic.Name, this.accessory.displayName);

  this.service.getCharacteristic(this.platform.Characteristic.On)
    .onSet(this.setOn.bind(this))
    .onGet(this.getOn.bind(this));

  this.platform.log.debug('ApartmentScenePlatformAccessory created for:', this.accessory.displayName);
  }

  /**
   * Sets the On/Off state of the apartment scene.
   * Called by Homebridge when the user activates/deactivates the scene switch.
   * @param value The new enable/disable value (true for enable, false for disable).
   */
  async setOn(value: CharacteristicValue) {
    const sceneId = this.accessory.context.scene.id as string;
    const sceneName = this.accessory.context.scene.attributes?.name as string;
    const sceneDef = APARTMENT_SCENE_DEFINITIONS.find((s) => s.id === sceneId);

    try {
      if (sceneDef?.type === 'button') {
        // Button: fire on press, reset tile back to off immediately
        if (value as boolean) {
          await this.platform.dsAPI.invokeScenario({ context: 'applicationApartment', actionId: sceneId });
          this.platform.log.info(`ApartmentScene → ${sceneName} → triggered`);
          setTimeout(() => this.service.updateCharacteristic(this.platform.Characteristic.On, false), 300);
        }
      } else {
        // Switch: on → id, off → id + 'End'
        if (value as boolean) {
          await this.platform.dsAPI.invokeScenario({ context: 'applicationApartment', actionId: sceneId });
          this.platform.log.info(`ApartmentScene → ${sceneName} → On`);
        } else {
          await this.platform.dsAPI.invokeScenario({ context: 'applicationApartment', actionId: `${sceneId}End` });
          this.platform.log.info(`ApartmentScene → ${sceneName} → Off`);
        }
      }
    } catch (error) {
      this.platform.log.error(`Failed to set ApartmentScene → ${sceneName}:`, error);
      throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
  }

  /**
   * Gets the current On/Off state of the apartment scene.
   * Returns the cached value — updates are handled by updateState on apartmentStatusChanged events.
   */
  async getOn(): Promise<CharacteristicValue> {
    return this.currentState;
  }

  /**
   * Updates the accessory state from the latest apartment status.
   * Called by the platform when apartment status changes.
   * @param apartmentStatus The latest apartment status object.
   */
  public updateState(apartmentStatus: ApartmentStatus): void {
    const sceneId = this.accessory.context.scene.id as string;
    const sceneDef = APARTMENT_SCENE_DEFINITIONS.find((s) => s.id === sceneId);

    if (!sceneDef) {
      return;
    }

    if (sceneDef.type === 'button') {
      return; // buttons have no readable state
    }

    const newValue = sceneDef.getValue(apartmentStatus) ?? false;
    if (newValue !== this.currentState) {
      this.currentState = newValue;
      this.service.updateCharacteristic(this.platform.Characteristic.On, this.currentState);
      this.platform.log.debug(`ApartmentScene → ${this.accessory.displayName} → ${this.currentState}`);
    }
  }
}
