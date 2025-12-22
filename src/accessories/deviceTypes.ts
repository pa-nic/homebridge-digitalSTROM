import type { FunctionBlock } from '../digitalStromTypes.js';

export type DeviceTypeKey = 'light' | 'shade';

export interface DeviceTypeConfig {
  prefixes: string[];
  validate: (device: FunctionBlock, technicalName: string) => boolean;
}

export const DEVICE_TYPE_CONFIG: Record<DeviceTypeKey, DeviceTypeConfig> = {
  light: {
    prefixes: ['GE', 'SW'],
    validate: (device: FunctionBlock, technicalName: string) => {
      if (technicalName.startsWith('SW') && technicalName !== 'SW-KL200') {
        return false;
      }
      return !!device.attributes?.outputs;
    },
  },
  shade: {
    prefixes: ['GR'],
    validate: (device: FunctionBlock) => {
      return !!device.attributes?.outputs?.find((o) => o.id === 'shadePositionOutside');
    },
  },
};