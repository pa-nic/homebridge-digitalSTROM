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
type ShadesStatusStatus = 'closed' | 'open' | 'moving' | 'mixed' | string;
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
  attributes?: {
    applications?: {
      shades?: {
        status?: ShadesStatusStatus;
        area1?: ShadesStatusStatus;
        area2?: ShadesStatusStatus;
        area3?: ShadesStatusStatus;
        area4?: ShadesStatusStatus;
      };
    };
  };
}

// Cluster Status
export interface ClusterStatus {
  id: string;
  attributes?: {
    weather?: {
      wind?: boolean;
      hail?: boolean;
    };
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
  lastChanged?: string;
  attributes?: {
    name?: string;
    security?: {
      alarm1?: { name?: string };
      alarm2?: { name?: string };
      alarm3?: { name?: string };
      alarm4?: { name?: string };
    };
    installation?: string;
    zones?: string[];
    dsDevices?: string[];
    clusters?: string[];
    applications2?: {
      ventilationUnit?: unknown; // Expand as needed
    };
  };
  included?: {
    installation?: unknown; // Expand as needed
    dsDevices?: DsDevice[];
    submodules?: Submodule[];
    functionBlocks?: FunctionBlock[];
    zones?: Zone[];
    scenarios?: unknown[]; // Expand as needed
    userDefinedStates?: unknown[]; // Expand as needed
    floors?: unknown[]; // Expand as needed
    clusters?: unknown[]; // Expand as needed
    applications?: unknown[]; // Deprecated
    dsServer?: unknown;
    controllers?: unknown[];
    apiRevision?: unknown;
    meterings?: unknown[];
  };
}

// Apartment Status
export interface ApartmentStatus {
  included?: {
    dsDevices?: DeviceStatus[];
    zones?: ZoneStatus[];
    clusters?: ClusterStatus[];
    userDefinedStates?: UserDefinedStateStatus[];
  };
}