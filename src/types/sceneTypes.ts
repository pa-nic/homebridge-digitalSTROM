import type { ApartmentStatus } from './digitalStromTypes.js';

export interface ApartmentSceneButtonDefinition {
  type: 'button';
  id: string;
  label: string;
}

export interface ApartmentSceneSwitchDefinition {
  type: 'switch';
  id: string;
  label: string;
  getValue: (status: ApartmentStatus) => boolean | undefined;
}

export type ApartmentSceneDefinition = ApartmentSceneButtonDefinition | ApartmentSceneSwitchDefinition;

export const APARTMENT_SCENE_DEFINITIONS: ApartmentSceneDefinition[] = [
  // Stateless buttons — invoke only, no readable state
  { type: 'button', id: 'absent',   label: 'Absent'   },
  { type: 'button', id: 'sleeping', label: 'Sleeping' },
  { type: 'button', id: 'present',  label: 'Present'  },
  { type: 'button', id: 'wakeup',   label: 'Wake Up'  },
  { type: 'button', id: 'doorbell', label: 'Doorbell' },

  // Stateful switches — on: invoke id, off: invoke id + 'End'
  { type: 'switch', id: 'panic',  label: 'Panic',   getValue: (a) => a.attributes?.security?.panic  },
  { type: 'switch', id: 'fire',   label: 'Fire',    getValue: (a) => a.attributes?.security?.fire   },
  { type: 'switch', id: 'alarm2', label: 'Alarm 2', getValue: (a) => a.attributes?.security?.alarm2 },
  { type: 'switch', id: 'alarm3', label: 'Alarm 3', getValue: (a) => a.attributes?.security?.alarm3 },
  { type: 'switch', id: 'alarm4', label: 'Alarm 4', getValue: (a) => a.attributes?.security?.alarm4 },
  { type: 'switch', id: 'wind',   label: 'Wind',    getValue: (a) => a.attributes?.weather?.wind    },
  { type: 'switch', id: 'rain',   label: 'Rain',    getValue: (a) => a.attributes?.weather?.rain    },
  { type: 'switch', id: 'hail',   label: 'Hail',    getValue: (a) => a.attributes?.weather?.hail    },
];
