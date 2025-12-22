// JSON:API double data wrapper interfaces
export interface ApiResponse<T> {
  data: {
    data: T;
  };
}

export interface PluginOptions {
  dssip: string;
  token: string;
  fingerprint?: string;
  disableCertificateValidation?: boolean;
}

// Interface for accessory handlers that support state updates.
export interface AccessoryHandler {
  updateState(apartmentStatus: ApartmentStatus): void;
}

// Enums from API schema and digitalSTROM documentation
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

export interface SensorStatus {
  id: string;
  status?: SensorStatusStatus;
  value?: number;
}

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

// Extend ApartmentStatus.included to match API (zones, clusters, userDefinedStates)
export interface ApartmentStatus {
  included?: {
    dsDevices?: DeviceStatus[];
    zones?: ZoneStatus[];
    clusters?: ClusterStatus[];
    userDefinedStates?: UserDefinedStateStatus[];
  };
}

// Minimal ZoneStatus placeholder used by shades.ts (applications.shades.*)
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

// Minimal ClusterStatus/UserDefinedStateStatus placeholders for type completeness
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

export interface UserDefinedStateStatus {
  id: string;
  attributes?: {
    status?: UserDefinedStateStatusStatus;
  };
}

export interface DeviceStatus {
  id: string;
  attributes?: {
    functionBlocks?: FunctionBlockStatus[];
    name?: string;
  };
}

export interface FunctionBlockStatus {
  id: string;
  outputs?: OutputStatus[];
  sensorInputs?: SensorStatus[];
}

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

// Add Apartment type matching OpenAPI schema
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
    dsDevices?: unknown[]; // Expand as needed
    submodules?: unknown[]; // Expand as needed
    functionBlocks?: FunctionBlock[];
    zones?: unknown[]; // Expand as needed
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