const pointWithinPolygon = require('../dist/point-within-polygon.cjs');
const pgFeature = require('./test.json');
const pointsWithinPolygon = require('@turf/points-within-polygon');

const pts = [];
for (let i = 0; i < 10000; i++) {
  const lon = 117.5 + (120.5 - 117.5) * Math.random();
  const lat = 31.5 + (33.5 - 31.5) * Math.random();
  pts.push({
    type: 'Feature',
    properties: {
      id: i,
    },
    geometry: {
      type: 'Point',
      coordinates: [lon, lat],
    },
  });
}

console.time('基于索引查询');
const result1 = pointWithinPolygon(pts, pgFeature, true);
console.timeEnd('基于索引查询');
console.log('选择的要素数量:' + result1.length);

console.time('不基于索引查询');
const result2 = pointWithinPolygon(pts, pgFeature, false);
console.timeEnd('不基于索引查询');
console.log('选择的要素数量:' + result2.length);

console.time('turf查询');
const result3 = pointsWithinPolygon(
  {
    type: 'FeatureCollection',
    features: pts,
  },
  pgFeature
);
console.timeEnd('turf查询');
console.log('选择的要素数量:' + result3.features.length);
