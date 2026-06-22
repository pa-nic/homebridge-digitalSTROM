import type { ApartmentStatus } from './digitalStromTypes.js';

export interface ApartmentSceneDefinition {
  id: string;
  resetId: string;
  label: string;
  getValue: (status: ApartmentStatus) => boolean | undefined;
}

export const APARTMENT_SCENE_DEFINITIONS: ApartmentSceneDefinition[] = [
  { id: 'absent',   resetId: 'present',   label: 'Absent',    getValue: (a) => a.attributes?.access?.absent   },
  { id: 'sleeping', resetId: 'wakeup',    label: 'Sleeping',  getValue: (a) => a.attributes?.user?.sleeping   },
  { id: 'panic',    resetId: 'panicEnd',  label: 'Panic',     getValue: (a) => a.attributes?.security?.panic  },
  { id: 'fire',     resetId: 'fireEnd',   label: 'Fire',      getValue: (a) => a.attributes?.security?.fire   },
  { id: 'alarm2',   resetId: 'alarm2End', label: 'Alarm 2',   getValue: (a) => a.attributes?.security?.alarm2 },
  { id: 'alarm3',   resetId: 'alarm3End', label: 'Alarm 3',   getValue: (a) => a.attributes?.security?.alarm3 },
  { id: 'alarm4',   resetId: 'alarm4End', label: 'Alarm 4',   getValue: (a) => a.attributes?.security?.alarm4 },
  { id: 'wind',     resetId: 'windEnd',   label: 'Wind',      getValue: (a) => a.attributes?.weather?.wind    },
  { id: 'rain',     resetId: 'rainEnd',   label: 'Rain',      getValue: (a) => a.attributes?.weather?.rain    },
  { id: 'hail',     resetId: 'hailEnd',   label: 'Hail',      getValue: (a) => a.attributes?.weather?.hail    },
];
