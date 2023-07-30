export class digitalStromURI {

  /*
   * Apartment
   */

  // Get apartment structure
  public getApartment(): string {
    return '/api/v1/apartment?includeAll=true';
  }

  // Get apartment status
  public getApartmentStatus(): string {
    return '/api/v1/apartment/status?includeAll=true';
  }

  /*
   * Device
   */

  // Tells device to execute the scene MAX.
  public turnOnDevice(dsuid: string): string {
    return `json/device/turnOn?dsuid=${dsuid}`;
  }

  // Tells device to execute the scene MIN.
  public turnOffDevice(dsuid: string): string {
    return `json/device/turnOff?dsuid=${dsuid}`;
  }

  // Set the value of one or more output channels of the device (i.e. brightness)
  public setOutputChannelValue(dsuid: string, channels: string): string {
    return `json/device/setOutputChannelValue?dsuid=${dsuid}&channelvalues=${channels}&applyNow=1`;
  }

  /*
   * System
   */

  // Creates a new session token using the provided credentials.
  public login(token: string): string {
    return `json/system/loginApplication?loginToken=${token}`;
  }

}