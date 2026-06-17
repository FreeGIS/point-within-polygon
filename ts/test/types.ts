import pointWithinPolygon, {
  type AreaFeature,
  type PointFeature,
} from '../src';

const points: PointFeature<{ id: string }>[] = [
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

const result = pointWithinPolygon(points, polygon, 1);
const id: string = result[0].properties.id;

void id;
