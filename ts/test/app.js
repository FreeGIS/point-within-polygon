const assert = require('assert');
const pointWithinPolygon = require('../dist/point-within-polygon.cjs');

function point(id, coordinates) {
  return {
    type: 'Feature',
    properties: { id },
    geometry: {
      type: 'Point',
      coordinates,
    },
  };
}

function polygon(coordinates) {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates,
    },
  };
}

function multiPolygon(coordinates) {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'MultiPolygon',
      coordinates,
    },
  };
}

function ids(features) {
  return features.map((feature) => feature.properties.id);
}

function assertSameIndexedAndPlain(points, area, expectedIds) {
  assert.deepStrictEqual(ids(pointWithinPolygon(points, area, true)), expectedIds);
  assert.deepStrictEqual(ids(pointWithinPolygon(points, area, false)), expectedIds);
}

const polygonWithHole = polygon([
  [
    [0, 0],
    [4, 0],
    [4, 4],
    [0, 4],
    [0, 0],
  ],
  [
    [1, 1],
    [3, 1],
    [3, 3],
    [1, 3],
    [1, 1],
  ],
]);

assertSameIndexedAndPlain(
  [
    point('inside shell', [0.5, 0.5]),
    point('inside hole', [2, 2]),
    point('outside', [5, 5]),
    point('boundary', [0, 1]),
  ],
  polygonWithHole,
  ['inside shell']
);

const groupedMultiPolygon = multiPolygon([
  [
    [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
      [0, 0],
    ],
  ],
  [
    [
      [0, 0],
      [4, 0],
      [4, 4],
      [3, 4],
      [3, 1],
      [1, 1],
      [1, 4],
      [0, 4],
      [0, 0],
    ],
  ],
]);

assertSameIndexedAndPlain(
  [
    point('inside first only', [1, 1]),
    point('inside second', [3.5, 0.5]),
    point('outside both', [2.5, 2]),
    point('boundary', [0, 1]),
  ],
  groupedMultiPolygon,
  ['inside first only', 'inside second']
);

assert.throws(
  () =>
    pointWithinPolygon([point('p', [0, 0])], {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 1],
        ],
      },
    }),
  /Polygon/
);

console.log('All point-within-polygon tests passed.');
