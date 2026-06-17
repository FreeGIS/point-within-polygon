/**
 * 使用 gdal-async 进行点在面内统计测试
 * 1. 读取 test.json 中的面要素
 * 2. 根据 bbox 随机生成 10000 个点
 * 3. 使用 GDAL 的几何相交判断统计在面内的点数
 * 4. 输出耗时统计
 */

const gdal = require('gdal-async');
const fs = require('fs');

async function main() {
  // ---------- 1. 读取面要素 ----------
  const geojsonStr = fs.readFileSync('./test.json', 'utf-8');
  const featureJson = JSON.parse(geojsonStr);

  // 支持 Feature 或 Geometry
  const geometryJson = featureJson.type === 'Feature'
    ? featureJson.geometry
    : featureJson;

  // 用 gdal 解析面几何
  const polygon = gdal.Geometry.fromGeoJson(geometryJson);

  // ---------- 2. 计算 bbox ----------
  const env = polygon.getEnvelope();
  const minX = env.minX;
  const maxX = env.maxX;
  const minY = env.minY;
  const maxY = env.maxY;

  console.log(`BBox: [${minX}, ${minY}, ${maxX}, ${maxY}]`);
  console.log(`面积 (平面): ${polygon.getArea().toFixed(8)}`);

  // ---------- 3. 预先创建 10000 个 gdal Point 对象 ----------
  const POINT_COUNT = 10000;
  console.log(`预先创建 ${POINT_COUNT} 个 gdal Point 对象...`);
  const points = [];
  for (let i = 0; i < POINT_COUNT; i++) {
    const x = minX + Math.random() * (maxX - minX);
    const y = minY + Math.random() * (maxY - minY);
    points.push(new gdal.Point(x, y));
  }
  console.log('Point 对象创建完毕。');

  // ---------- 4. 仅计时 contains 判断耗时 ----------
  console.log(`\n开始点在面内判断，共 ${POINT_COUNT} 个点...`);
  const t0 = performance.now();

  let insideCount = 0;
  for (let i = 0; i < POINT_COUNT; i++) {
    if (polygon.contains(points[i])) {
      insideCount++;
    }
  }

  const t1 = performance.now();
  const elapsed = (t1 - t0).toFixed(2);

  // ---------- 5. 输出结果 ----------
  console.log(`\n===== 统计结果 =====`);
  console.log(`总点数:       ${POINT_COUNT}`);
  console.log(`面内点数:     ${insideCount}`);
  console.log(`面外点数:     ${POINT_COUNT - insideCount}`);
  console.log(`面内比例:     ${((insideCount / POINT_COUNT) * 100).toFixed(2)}%`);
  console.log(`耗时:         ${elapsed} ms`);
  console.log(`单点平均耗时: ${((t1 - t0) / POINT_COUNT).toFixed(4)} ms`);
}

main().catch(console.error);
