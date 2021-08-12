# point-within-polygon
基于射线法快速实现判别点在面内,在批量点和复杂面的情况下优化非常明显，通常有近20倍的性能提升。支持判别点在Polygon，点在MultiPolygon内的批量判断计算。
## 原理说明
默认射线法是通过比较点和segment的交点数量来确定点是否在面内，假设面有m个顶点(m-1个segment），有n个需要判别的点，则计算量为（m-1)*n，当m特别大时，面异常复杂，可能还会存在大量的孔洞，此时计算量会非常大，性能很低，如下图：
![复杂面](https://github.com/FreeGIS/point-within-polygon/blob/master/doc/polygon.png)

本方案通过对面的segment建立rtree索引，从而避免逐线段比较，通过索引快速过滤出若干segment，导致计算量大大减少:

![segement建立rtree索引](https://github.com/FreeGIS/point-within-polygon/blob/master/doc/segement-rtree.png)


## 安装
```
npm install point-within-polygon --save
```

## 使用
支持在nodejs中使用，同时支持以es6形式在前端使用。

point_within_polygon(ptFeatures,pgFeature,withIndexs=1)

ptFeatures:GeoJSON的feature数组。

pgFeature:GeoJSON的Polygon或MultiPolygon面数据。

withIndexs:是否使用索引查询，默认1是基于Segment的rtree索引查询。

使用参考如下示例：
```
const point_within_polygon = require('point-within-polygon');
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
const result1 = point_within_polygon(pts, pgFeature,1);
console.timeEnd('基于索引查询');
console.log('选择的要素数量:'+result1.length);


console.time('不基于索引查询');
const result2 = point_within_polygon(pts, pgFeature,0);
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
