// JSON:API double data wrapper interfaces
export interface ApiResponse<T> {
  data: {
    data: T;
  };
}

// Plugin options
export interface PluginOptions {
  dssip: string;
  token: string;
  fingerprint?: string;
  disableCertificateValidation?: boolean;
  enableApartmentScenes?: boolean;
}

// Accessory handler interface
export interface AccessoryHandler {
  updateState(apartmentStatus: ApartmentStatus): void;
}

// ===== Enums and Type Aliases =====

// Output
type OutputType =
  | 'lightBrightness'
  | 'lightHue'
  | 'lightSaturation'
  | 'lightTemperature'
  | 'lightCieX'
  | 'lightCieY'
  | 'shadePositionOutside'
  | 'shadePositionIndoor'
  | 'shadeOpeningAngleOutside'
  | 'shadeOpeningAngleIndoor'
  | 'shadeTransparency'
  | 'airFlowIntensity'
  | 'airFlowDirection'
  | 'airFlapOpeningAngle'
  | 'ventilationLouverPosition'
  | 'heatingPower'
  | 'coolingCapacity'
  | 'audioVolume'
  | 'powerState'
  | 'ventilationSwingMode'
  | 'ventilationAutoIntensity'
  | 'waterTemperature'
  | 'waterFlowRate'
  | 'powerLevel'
  | 'videoStation'
  | 'videoInputSource'
  | string;

type OutputFunction = 'switched' | 'gradual' | 'positional' | 'internal' | string;
type OutputMode = 'disabled' | 'switched' | 'gradual' | 'positional' | 'internal' | string;

// Button
type ButtonType =
  | 'device'
  | 'area1'
  | 'area2'
  | 'area3'
  | 'area4'
  | 'zone'
  | 'zone1'
  | 'zone2'
  | 'zone3'
  | 'zone4'
  | 'zonex1'
  | 'zonex2'
  | 'zonex3'
  | 'zonex4'
  | 'application'
  | 'group'
  | 'appmode'
  | string;

type ButtonMode = 'disabled' | 'button1way' | 'button2way' | string;

// Sensor
type MeasurementType =
  | 'temperature'
  | 'brightness'
  | 'humidity'
  | 'carbonDioxide'
  | 'temperatureSetpoint'
  | 'temperatureControlValue'
  | 'energy'
  | 'energyCounter'
  | string;

type MeasurementUsage =
  | 'zone'
  | 'outdoor'
  | 'settings'
  | 'device'
  | 'deviceLastRun'
  | 'deviceAverage'
  | string;

// Status
type OutputStatusStatus =
  | 'ok'
  | 'moving'
  | 'dimming'
  | 'overload'
  | 'blocked'
  | 'error'
  | 'standby'
  | string;

type SensorStatusStatus = 'ok' | 'error' | string;
type UserDefinedStateStatusStatus = 'active' | 'inactive' | 'undefined' | string;

// ===== Core Entities =====

// Output
export interface Output {
  id: string;
  attributes?: {
    name?: string;
    technicalName?: string;
    type?: OutputType;
    function?: OutputFunction;
    min?: number;
    max?: number;
    resolution?: number;
    mode?: OutputMode;
    levels?: number;
    levelThresholds?: number[];
  };
}

// Button
export interface Button {
  id: string;
  attributes?: {
    name?: string;
    technicalName?: string;
    type?: ButtonType;
    mode?: ButtonMode;
    channel?: number;
  };
}

// Sensor
export interface Sensor {
  id: string;
  attributes?: {
    name?: string;
    technicalName?: string;
    type?: MeasurementType;
    usage?: MeasurementUsage;
    min?: number;
    max?: number;
    resolution?: number;
  };
}

// Installation
export interface Installation {
  id: string;
  type: 'installation' | string;
  attributes?: {
    location?: {
      longitude?: number;
      latitude?: number;
    };
    countryCode?: string;
    city?: string;
    timeZone?: string;
  };
}

// dsDevice
export interface DsDevice {
  id: string;
  type: 'dsDevice' | string;
  lastChanged?: string;
  attributes?: {
    name?: string;
    serialNumber?: string;
    macAddress?: string;
    model?: string;
    firmwareVersion?: string;
    functionBlocks?: FunctionBlock[];
    submodules?: string[]; // Array of submodule IDs
  };
}

// Submodule
export interface Submodule {
  id: string;
  type: 'submodule' | string;
  lastChanged?: string;
  attributes?: {
    name?: string;
    technicalName?: string;
    deviceAdapter?: string;
  };
}

// Function Block
export interface FunctionBlock {
  id: string;
  type: 'functionBlock' | string;
  lastChanged?: string;
  attributes?: {
    name?: string;
    technicalName?: string;
    active?: boolean;
    outputs?: Output[];
    buttonInputs?: Button[];
    sensorInputs?: Sensor[];
    submodule?: string;
    deviceAdapter?: string;
  };
}

// Zone
export interface Zone {
  id: string;
  type: 'zone' | string;
  lastChanged?: string;
  attributes?: {
    name?: string;
    floor?: string;
    orderId?: number;
    submodules?: string[];
    applications?: string[];
    applicationTypes?: string[];
    applicationDetails?: Array<{
      id: string;
      areas: Array<{
        id: string;
        name: string;
      }>;
    }>;
  };
}

// ===== Status Entities =====

// Output Status
export interface OutputStatus {
  id: string;
  targetValue: number;
  value: number;
  status?: OutputStatusStatus;
  initialValue?: number;
  startedAt?: string;
  terminatesAt?: string;
  level?: number;
}

// Sensor Status
export interface SensorStatus {
  id: string;
  status?: SensorStatusStatus;
  value?: number;
}

// Function Block Status
export interface FunctionBlockStatus {
  id: string;
  outputs?: OutputStatus[];
  sensorInputs?: SensorStatus[];
}

// Device Status
export interface DeviceStatus {
  id: string;
  attributes?: {
    functionBlocks?: FunctionBlockStatus[];
    name?: string;
  };
}

// Zone Status
export interface ZoneStatus {
  id: string;
  type?: 'zoneStatus' | string;
  attributes?: {
    applications?: {
      id: string;
      status?: string;
      nonLocalPriority?: string;
      area1?: string;
      area2?: string;
      area3?: string;
      area4?: string;
    };
  };
}

// Cluster Status
export interface ClusterStatus {
  id: string;
  attributes?: {
    operationsLocked?: boolean;
  };
}

// User Defined State Status
export interface UserDefinedStateStatus {
  id: string;
  attributes?: {
    status?: UserDefinedStateStatusStatus;
  };
}

// ===== Apartment & Status Root Entities =====

// Apartment
export interface Apartment {
  id: string;
  type: 'apartment' | string;
  attributes?: {
    name?: string;
    zones?: string[];
    dsDevices?: string[];
    clusters?: string[];
  };
  included?: {
    installation?: Installation;
    dsDevices?: DsDevice[];
    submodules?: Submodule[];
    functionBlocks?: FunctionBlock[];
    zones?: Zone[];
  };
}

// Apartment Status
export interface ApartmentStatus {
  attributes?: {
    access?: { absent?: boolean };
    user?: { sleeping?: boolean };
    security?: {
      panic?: boolean;
      fire?: boolean;
      alarm1?: boolean;
      alarm2?: boolean;
      alarm3?: boolean;
      alarm4?: boolean;
    };
    weather?: { 
      wind?: boolean; 
      rain?: boolean; 
      hail?: boolean; 
    };
  };
  included?: {
    dsDevices?: DeviceStatus[];
    zones?: ZoneStatus[];
    clusters?: ClusterStatus[];
    userDefinedStates?: UserDefinedStateStatus[];
  };
}

// ===== Scenario Invoke =====

export type ScenarioApplication = 'lights' | 'shades' | 'awnings' | 'audio' | 'video' | 'ventilation' | 'recirculation';

export type DeviceActionId = 'off' | 'on' | 'localOff' | 'localOn' | 'stop' | 'impulse' | 'inc' | 'dec';

/** Whole apartment — application action (e.g. lights off) or system action (e.g. absent, no application) */
export interface InvokeApartmentScenarioBody {
  context: 'applicationApartment';
  actionId: string;
  application?: ScenarioApplication;
}

/** Single zone */
export interface InvokeZoneScenarioBody {
  context: 'applicationZone';
  actionId: string;
  application: ScenarioApplication;
  zone: string;
}

/** Area 1–4 within a zone (lights or shades only) */
export interface InvokeAreaScenarioBody {
  context: 'applicationArea';
  actionId: string;
  application: 'lights' | 'shades';
  zone: string;
  area: '1' | '2' | '3' | '4';
}

/** Single device — only DeviceActionId values allowed, no application or zone */
export interface InvokeDeviceScenarioBody {
  context: 'applicationDevice';
  actionId: DeviceActionId;
  dsDevice: string;
}

/** Named cluster of devices */
export interface InvokeClusterScenarioBody {
  context: 'applicationCluster';
  actionId: string;
  application: ScenarioApplication;
  cluster: string;
}

export type InvokeScenarioBody =
  | InvokeApartmentScenarioBody
  | InvokeZoneScenarioBody
  | InvokeAreaScenarioBody
  | InvokeDeviceScenarioBody
  | InvokeClusterScenarioBody;