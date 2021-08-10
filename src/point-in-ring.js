/* eslint-disable camelcase */
//点在环内 射线法，点在面内返回第一个x交点,带索引查询
export function isPointInRingWithIndexs(point, segmentSpatialIndex) {
  //点做射线
  const ray_bbox = {
    minX: point[ 0 ],
    minY: point[ 1 ],
    maxX: point[ 0 ] + 1000000000,
    maxY: point[ 1 ],
  };
  let x_intesect = null;
  // 为加快查询，直接根据ringMetedata查询与射线存在相交可能的线段
  const searchs = segmentSpatialIndex.search(ray_bbox);
  // 基于射线法原理，判断交点数量
  let intersects = 0;
  //首先判断点是否在线段上
  for (let segment of searchs) {
    // 点如果在ring边界上，证明点不在ring内部
    if (segmentContains(segment.start, segment.end, point)) {
      return -1;
    }
    // 边平行 特殊情况跳过
    if (segment.start[ 1 ] === segment.end[ 1 ])
      continue;
    // 求相交点
    const x = (point[ 1 ] - segment.start[ 1 ]) * (segment.end[ 0 ] - segment.start[ 0 ]) / (segment.end[ 1 ] - segment.start[ 1 ]) + segment.start[ 0 ];
    if (x_intesect === null)
      x_intesect = x;
    //交点x坐标应该大于point射线起点的坐标，因为射线向右
    if (x <= point[ 0 ])
      continue;
    // 相交点如果与segment顶点重合
    if (x === segment.start[ 0 ] && point[ 1 ] === segment.start[ 1 ]) {
      if (point[ 1 ] > segment.end[ 1 ]) {
        intersects++;
      }

    }
    else if (x === segment.end[ 0 ] && point[ 1 ] === segment.end[ 1 ]) {
      if (point[ 1 ] > segment.start[ 1 ]) {
        intersects++;
      }
    }
    else {
      intersects++;
    }
  }
  if (intersects % 2 === 1)
    return x_intesect;
  return -1;
}

// 不带索引查询
export function isPointInRingWithoutIndexs(point, ring) {
  // 基于射线法原理，判断交点数量
  let intersects = 0;
  let x_intesect = null;
  // 面的顶点数量
  const vert_count = ring.length;
  for (let i = 1; i < vert_count; i++) {
    const segment = [ ring[ i - 1 ], ring[ i ] ];
    //点必须在以segment为对角线的面内，否则一定是和 线没有交点
    if (point[ 1 ] < Math.min(segment[ 0 ][ 1 ], segment[ 1 ][ 1 ]))
      continue;
    if (point[ 1 ] > Math.max(segment[ 0 ][ 1 ], segment[ 1 ][ 1 ]))
      continue;
    // 点如果在ring边界上，证明点不在ring内部
    if (segmentContains(segment[ 0 ], segment[ 1 ], point)) {
      return -1;
    }
    // 边平行，既边是水平的，线段起点终点y坐标相等 特殊情况跳过
    if (segment[ 0 ][ 1 ] === segment[ 1 ][ 1 ])
      continue;
    // 求相交点x坐标 水平射线向右，y轴都相等，不用计算。
    const x = (point[ 1 ] - segment[ 0 ][ 1 ]) * (segment[ 1 ][ 0 ] - segment[ 0 ][ 0 ]) / (segment[ 1 ][ 1 ] - segment[ 0 ][ 1 ]) + segment[ 0 ][ 0 ];
    if (x_intesect === null)
      x_intesect = x;
    //交点x坐标应该大于point射线起点的坐标，因为射线向右
    if (x <= point[ 0 ])
      continue;
    // 如果相交点如果与线段segment的起点重合
    if (x === segment[ 0 ][ 0 ] && point[ 1 ] === segment[ 0 ][ 1 ]) {
      if (point[ 1 ] > segment[ 1 ][ 1 ])
        intersects++;
    }
    // 如果相交点如果与线段segment的终点重合
    else if (x === segment[ 1 ][ 0 ] && point[ 1 ] === segment[ 1 ][ 1 ]) {
      if (point[ 1 ] > segment[ 0 ][ 1 ])
        intersects++;
    }
    else {
      intersects++;
    }
  }
  // 穿越次数是奇数，点在面内
  if (intersects % 2 === 1)
    return x_intesect;
  return -1;
}





// 点在线段上算法，两点保证： 1 c在ab的线上 2 c不在ab线的延长线上
function segmentContains(a, b, c) {
  let i;
  // +() 强转数字，等同于Number()，意思是共线的时候，如果x轴相同，就仅仅将y的值参与计算，否则，仅仅比较x值就可以了
  i = +(a[ 0 ] === b[ 0 ]);
  const p = a[ i ];
  return collinear(a, b, c) && within(p, c[ i ], b[ i ]);
}
// 三点共线，保证点在线上
function collinear(a, b, c) {
  return (b[ 0 ] - a[ 0 ]) * (c[ 1 ] - a[ 1 ]) === (c[ 0 ] - a[ 0 ]) * (b[ 1 ] - a[ 1 ]);
}
// 保证点不在线的延长线上
function within(p, q, r) {
  return p <= q && q <= r || r <= q && q <= p;
}
