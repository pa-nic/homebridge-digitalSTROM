import { PlatformAccessory } from 'homebridge';
import { DigitalStromPlatform } from '../platform';
import { digitalStromAPI } from '../digitalStromAPI';

/**
 * Base class for digitalStrom accessories
 */
export abstract class dssAccessory {
  public readonly dsAPI!: digitalStromAPI;

  constructor(
    protected readonly platform: DigitalStromPlatform,
    protected readonly accessory: PlatformAccessory,
  ) {

    this.configureDevice();
  }

  /**
   * All accessories require a configureDevice function. This is where all the
   * accessory-specific configuration and setup happens.
   */ 
  protected abstract configureDevice(): void;

  /**
   * All accessories require an updateState function. This function gets called every
   * time an apartmentStatusChanged message is received and triggers a status refesh to 
   * update the accessories with their latest DSS status
   */  
  abstract updateState(apartmentStatusStatus);

}