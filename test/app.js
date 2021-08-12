const point_within_polygon = require('../dist/point-within-polygon-cjs');
const pgFeature = require('./test.json');

const pointsWithinPolygon = require('@turf/points-within-polygon');

//区间内随机生成1万个点
let pts = [];
for (let i = 0; i < 10000; i++) {
    const lon = 117.5 + (120.5 - 117.5) * Math.random();
    const lat = 31.5 + (33.5 - 31.5) * Math.random();
    pts.push({
        'type': 'Feature',
        'properties': {
            'id': i
        },
        'geometry': {
            'type': 'Point',
            'coordinates': [lon, lat]
        }
    })
}

console.time('基于索引查询');
const result1 = point_within_polygon(pts, pgFeature, 1);
console.timeEnd('基于索引查询');
console.log('选择的要素数量:' + result1.length);


console.time('不基于索引查询');
const result2 = point_within_polygon(pts, pgFeature, 0);
console.timeEnd('不基于索引查询');
console.log('选择的要素数量:' + result2.length);

console.time('turf查询');
const result3 = pointsWithinPolygon({
    "type": "FeatureCollection",
    "features": pts
}, pgFeature);
console.log('选择的要素数量:' + result3.features.length);
console.timeEnd('turf查询');