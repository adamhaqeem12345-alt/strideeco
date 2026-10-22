import type { Coordinate } from './geo';

export type MachineType = 'bottled-ambient' | 'bottled-chilled' | 'refill';
export type Machine = {
  id: string;
  name: string;
  type: MachineType;
  coordinate: Coordinate;
  rewardLabel: string;
  enabled: boolean;
  status: 'mock';
};

export const machineTypes: { id: MachineType; label: string; rewardLabel: string }[] = [
  { id: 'bottled-ambient', label: 'Ambient bottled water', rewardLabel: '500 ml ambient drinking-water bottle' },
  { id: 'bottled-chilled', label: 'Chilled bottled water', rewardLabel: '500 ml chilled drinking-water bottle' },
  { id: 'refill', label: 'Water refill', rewardLabel: '500 ml drinking-water refill' },
];

export const machineCatalogNote = 'Mock locations in the mapped Elmina area. No installed machines, stock or operator partnership is confirmed.';

// Illustrative coordinates within the existing OSM extract, not vending-machine
// observations or a real inventory. Keep these separate from sourced map data.
export const machines: Machine[] = [
  { id: 'mock-central-ambient', name: 'Central Park west mock stop', type: 'bottled-ambient', coordinate: [101.5127, 3.1769], rewardLabel: machineTypes[0].rewardLabel, enabled: true, status: 'mock' },
  { id: 'mock-central-chilled', name: 'Central Park east mock stop', type: 'bottled-chilled', coordinate: [101.5160, 3.1784], rewardLabel: machineTypes[1].rewardLabel, enabled: true, status: 'mock' },
  { id: 'mock-central-refill', name: 'Central Park lake mock stop', type: 'refill', coordinate: [101.5144, 3.1779], rewardLabel: machineTypes[2].rewardLabel, enabled: true, status: 'mock' },
  { id: 'mock-urban-ambient', name: 'Urban Park west mock stop', type: 'bottled-ambient', coordinate: [101.5088, 3.1793], rewardLabel: machineTypes[0].rewardLabel, enabled: true, status: 'mock' },
  { id: 'mock-urban-chilled', name: 'Urban Park north mock stop', type: 'bottled-chilled', coordinate: [101.5119, 3.1814], rewardLabel: machineTypes[1].rewardLabel, enabled: true, status: 'mock' },
  { id: 'mock-urban-refill', name: 'Urban Park garden mock stop', type: 'refill', coordinate: [101.5105, 3.1802], rewardLabel: machineTypes[2].rewardLabel, enabled: true, status: 'mock' },
];

export function isMachineType(value: unknown): value is MachineType {
  return machineTypes.some(type => type.id === value);
}

export function getMachine(id: string): Machine | undefined {
  return machines.find(machine => machine.id === id && machine.enabled);
}

function validCoordinate(value: Coordinate) {
  return Array.isArray(value) && value.length === 2 && Number.isFinite(value[0]) && Number.isFinite(value[1]) &&
    value[0] >= -180 && value[0] <= 180 && value[1] >= -90 && value[1] <= 90;
}

/** Straight-line distance on the earth, not a walking route or access claim. */
export function haversineMetres(a: Coordinate, b: Coordinate): number {
  if (!validCoordinate(a) || !validCoordinate(b)) throw new Error('A valid longitude/latitude reference is required.');
  const radians = Math.PI / 180;
  const latitude = (b[1] - a[1]) * radians;
  const longitude = (b[0] - a[0]) * radians;
  const chord = Math.sin(latitude / 2) ** 2 + Math.cos(a[1] * radians) * Math.cos(b[1] * radians) * Math.sin(longitude / 2) ** 2;
  return 6_371_008.8 * 2 * Math.atan2(Math.sqrt(Math.min(1, chord)), Math.sqrt(Math.max(0, 1 - chord)));
}

export function nearestMachines(reference: Coordinate, type: MachineType | 'all' = 'all', catalog: readonly Machine[] = machines) {
  if (!validCoordinate(reference)) return [];
  return catalog.filter(machine => machine.enabled && (type === 'all' || machine.type === type) && validCoordinate(machine.coordinate))
    .map(machine => ({ machine, distanceMetres: haversineMetres(reference, machine.coordinate) }))
    .sort((a, b) => a.distanceMetres - b.distanceMetres || a.machine.id.localeCompare(b.machine.id));
}

export function nearestMachine(reference: Coordinate, type: MachineType | 'all' = 'all', catalog: readonly Machine[] = machines) {
  return nearestMachines(reference, type, catalog)[0];
}
