const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { machines, machineTypes, getMachine, isMachineType, haversineMetres, nearestMachines, nearestMachine } = require('../work/machines.cjs');

test('mock water catalog is explicitly illustrative and stays inside the sourced map coverage', () => {
  const map = JSON.parse(fs.readFileSync(path.join(__dirname, '../lib/elmina-map.json'), 'utf8'));
  const [west, south, east, north] = map.meta.bbox;
  assert.equal(new Set(machines.map(machine => machine.id)).size, machines.length);
  assert.equal(machines.length, 6);
  assert.equal(machineTypes.length, 3);
  for (const machine of machines) {
    assert.equal(machine.status, 'mock');
    assert.ok(machine.name.includes('mock'));
    assert.match(machine.id, /^mock-/);
    assert.match(machine.rewardLabel, /drinking-water/);
    assert.ok(isMachineType(machine.type));
    assert.ok(machine.coordinate[0] >= west && machine.coordinate[0] <= east);
    assert.ok(machine.coordinate[1] >= south && machine.coordinate[1] <= north);
  }
  assert.equal(getMachine('invented-real-machine'), undefined);
  assert.equal(isMachineType('snacks'), false);
});

test('Haversine distance handles longitude/latitude, zero distance and global wraparound', () => {
  assert.equal(haversineMetres([101.513, 3.1795], [101.513, 3.1795]), 0);
  assert.ok(Math.abs(haversineMetres([0, 0], [1, 0]) - 111195) < 2);
  assert.ok(Math.abs(haversineMetres([179.9, 0], [-179.9, 0]) - 22239) < 2);
  assert.equal(haversineMetres([0, 0], [1, 0]), haversineMetres([1, 0], [0, 0]));
  assert.throws(() => haversineMetres([101, 91], [101, 3]), /valid longitude\/latitude/);
});

test('nearest selection ranks compatible enabled mock stops from the explicit reference', () => {
  const reference = getMachine('mock-central-chilled').coordinate;
  assert.equal(nearestMachine(reference).machine.id, 'mock-central-chilled');
  assert.equal(nearestMachine(reference).distanceMetres, 0);
  const refills = nearestMachines(reference, 'refill');
  assert.equal(refills.length, 2);
  assert.equal(refills[0].machine.id, 'mock-central-refill');
  assert.ok(refills.every(result => result.machine.type === 'refill'));
  assert.ok(refills[0].distanceMetres < refills[1].distanceMetres);
  const withDisabled = machines.map(machine => ({ ...machine, enabled: machine.id !== 'mock-central-chilled' }));
  assert.equal(nearestMachine(reference, 'bottled-chilled', withDisabled).machine.id, 'mock-urban-chilled');
  assert.equal(nearestMachine(reference, 'refill', []), undefined);
  assert.deepEqual(nearestMachines([NaN, 3]), []);
});

test('equal-distance ranking is stable by machine ID without mutating the supplied inventory', () => {
  const original = getMachine('mock-central-ambient');
  const catalog = [{ ...original, id: 'mock-z' }, { ...original, id: 'mock-a' }];
  assert.deepEqual(nearestMachines(original.coordinate, 'all', catalog).map(result => result.machine.id), ['mock-a', 'mock-z']);
  assert.deepEqual(catalog.map(machine => machine.id), ['mock-z', 'mock-a']);
});
