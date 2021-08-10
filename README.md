# point-in-polygon
基于射线法快速实现判别点在面内,在批量点和复杂面的情况下优化非常明显，通常有近20倍的性能提升。支持判别点在Polygon，点在MultiPolygon内的批量判断计算。
## 原理说明


## 安装
```
npm install point-within-polygon --save
```

## 使用
point_within_polygon支持两种点在面内查询，一种是支持面带segment rtree索引的查询方式，一种是原始的射线法逐一判断方式，使用参考如下示例：
```
const point_within_polygon = require('../dist/point-within-polygon-cjs');
const pgFeature = require('./test.json');

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
            'coordinates': [ lon, lat ]
        }
    })
}

console.time('基于索引查询');
const result1 = point_within_polygon.isPointInPolygonWithIndexs(pts, pgFeature);
console.timeEnd('基于索引查询');
console.log('选择的要素数量:'+result1.length);


console.time('不基于索引查询');
const result2 = point_within_polygon.isPointInPolygonWithOutIndexs(pts, pgFeature);
console.timeEnd('不基于索引查询');
console.log('选择的要素数量:'+result2.length);
```

## 性能比较
1万点在面内计算耗时：
```
基于索引查询: 223.886ms
选择的要素数量:1778
不基于索引查询: 3900.868ms
选择的要素数量:1778
```
带索引的查询耗时远远优于默认的射线法耗时，尤其在点足够多，面足够复杂的情况下提升更明显。
