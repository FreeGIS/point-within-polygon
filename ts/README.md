# point-within-polygon

Batch point-in-Polygon/MultiPolygon filtering for GeoJSON point features.

The package uses spatial indexes internally to reduce candidate rings and segments before running the ray-casting test. Boundary points are treated as outside.

## Install

```bash
npm install point-within-polygon --save
```

## Usage

CommonJS:

```js
const pointWithinPolygon = require('point-within-polygon');

const result = pointWithinPolygon(pointFeatures, polygonFeature);
```

TypeScript / ES Module:

```ts
import pointWithinPolygon, {
  type AreaFeature,
  type PointFeature,
} from 'point-within-polygon';

const points: PointFeature[] = [];
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

## Development

```bash
npm install
npm run typecheck
npm run build
npm test
```
