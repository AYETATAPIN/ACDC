import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toggleBendPointPoints } from '../frontend/src/utils/bendPoints.js';

test('toggleBendPointPoints removes a nearby bend point', () => {
  const points = [
    { x: 0, y: 0 },
    { x: 50, y: 0 },
    { x: 100, y: 0 }
  ];
  const click = { x: 51, y: 1 };
  const result = toggleBendPointPoints(points, click, 1);
  assert.equal(result.removedIndex, 1);
  assert.equal(result.points.length, 2);
  assert.deepEqual(result.points, [{ x: 0, y: 0 }, { x: 100, y: 0 }]);
});

test('toggleBendPointPoints adds a bend point when none is nearby', () => {
  const points = [
    { x: 0, y: 0 },
    { x: 100, y: 0 }
  ];
  const click = { x: 50, y: 10 };
  const result = toggleBendPointPoints(points, click, 1);
  assert.equal(result.addedIndex, 1);
  assert.equal(result.points.length, 3);
  assert.deepEqual(result.points[1], click);
});
