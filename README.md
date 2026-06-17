# point-within-polygon

用于批量判断点是否落在 Polygon/MultiPolygon 内的高性能实现集合。

当前仓库按语言拆分：

- `ts/`：TypeScript / JavaScript npm 包
- `java/`：基于 JTS `STRtree` 的 Java 版本
- `rust/`：基于 `geo-index` 的 Rust 版本

三套实现保持同一套核心语义：

- 支持 Polygon / MultiPolygon
- 外环命中且不落入洞内时判定为面内
- MultiPolygon 按 polygon 分组判断，避免不同 polygon 的外环/洞互相干扰
- 点在边界上按面外处理
- 默认使用空间索引进行候选 ring / segment 剪枝

## TypeScript 包

### 安装

```bash
cd ts
npm install
npm run build
```

发布包使用：

```bash
npm install point-within-polygon --save
```

### 使用

CommonJS：

```js
const pointWithinPolygon = require('point-within-polygon');

const result = pointWithinPolygon(pointFeatures, polygonFeature);
```

ES Module / TypeScript：

```ts
import pointWithinPolygon, {
  type AreaFeature,
  type PointFeature,
} from 'point-within-polygon';

const points: PointFeature[] = [
  {
    type: 'Feature',
    properties: { id: 'p1' },
    geometry: {
      type: 'Point',
      coordinates: [0.5, 0.5],
    },
  },
];

const polygon: AreaFeature = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0],
      ],
    ],
  },
};

const result = pointWithinPolygon(points, polygon);
```

函数签名：

```ts
pointWithinPolygon(pointFeatures, polygonFeature): PointFeature[]
```

`pointFeatures` 是 GeoJSON Point Feature 数组，`polygonFeature` 是 GeoJSON Polygon 或 MultiPolygon Feature。

## Java 版本

```bash
cd java
mvn test
```

Java 版本使用 JTS geometry 作为输入，并用 JTS `STRtree` 构建 ring 和 segment 两级空间索引。

## Rust 版本

```bash
cd rust
cargo test
cargo clippy --all-targets -- -D warnings
```

Rust 版本使用 `geo-index` 构建不可变 R-tree：

- 全局 ring bbox 索引
- 每个 ring 内部 segment bbox 索引

## 算法说明

传统射线法需要让每个点与面的所有边段逐一做相交判断。若面有 `m` 条边段、点数量为 `n`，复杂度接近 `O(n*m)`。

本项目的实现先建立空间索引：

1. 拆分 Polygon/MultiPolygon 的 ring。
2. 为 ring bbox 建立空间索引，快速筛选候选 ring。
3. 为每个 ring 的 segment bbox 建立空间索引。
4. 对点发出水平射线，只和候选 segment 做相交计数。
5. 对 Polygon 按“外环命中且不在洞内”聚合结果。
6. 对 MultiPolygon 按 polygon 分组，任一 polygon 命中即返回面内。

这种方式在复杂面和大量点批量判断场景下，能显著减少无关边段计算。

## 验证命令

TypeScript：

```bash
cd ts
npm run typecheck
npm run build
npm test
npm run test:perf
```

Java：

```bash
cd java
mvn test
```

Rust：

```bash
cd rust
cargo fmt
cargo test
cargo clippy --all-targets -- -D warnings
```
