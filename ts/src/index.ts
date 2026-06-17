import RBush from 'rbush';
import { isPointInRingWithIndexes, isPointInRingWithoutIndexes } from './point-in-ring';
import type {
  AreaFeature,
  BBox,
  LinearRing,
  MultiPolygonFeature,
  PointFeature,
  PolygonFeature,
  PolygonCoordinates,
  RingTreeItem,
  SegmentItem,
} from './types';

const enum RingRole {
  Shell = 0,
  Hole = 1,
}

const enum RingContainment {
  OutsideShell = 0,
  InsideShell = 1,
  InsideHole = 2,
  OutsideHole = 3,
}

interface RingIndex {
  ringId: string;
  segmentIndex: RBush<SegmentItem>;
  role: RingRole;
  polygonId: number;
}

interface GeometryIndex {
  ringsTree: RBush<RingTreeItem>;
  rings: Record<string, RingIndex>;
}

export type {
  AreaFeature,
  Feature,
  LinearRing,
  MultiPolygonFeature,
  MultiPolygonGeometry,
  PointFeature,
  PointGeometry,
  PolygonFeature,
  PolygonGeometry,
  Position,
} from './types';

function pointWithinPolygon<TPoint extends PointFeature>(
  pointFeatures: readonly TPoint[],
  polygonFeature: AreaFeature,
  withIndexes: boolean | 0 | 1 = true
): TPoint[] {
  if (withIndexes) {
    return isPointInPolygonWithIndexes(pointFeatures, polygonFeature);
  }
  return isPointInPolygonWithoutIndexes(pointFeatures, polygonFeature);
}

function isPointInPolygonWithIndexes<TPoint extends PointFeature>(
  pointFeatures: readonly TPoint[],
  polygonFeature: AreaFeature
): TPoint[] {
  const type = polygonFeature.geometry.type;
  if (type === 'Polygon') {
    const { ringsTree, rings } = getPolygonIndex(polygonFeature.geometry.coordinates);
    return pointFeatures.filter((feature) =>
      isPointInIndexedPolygon(feature, ringsTree, rings)
    );
  }
  if (type === 'MultiPolygon') {
    const { ringsTree, rings } = getMultiPolygonIndex(polygonFeature.geometry.coordinates);
    return pointFeatures.filter((feature) =>
      isPointInIndexedMultiPolygon(feature, ringsTree, rings)
    );
  }
  throw new Error('面类型必须是Polygon或MultiPolygon类型！');
}

function isPointInPolygonWithoutIndexes<TPoint extends PointFeature>(
  pointFeatures: readonly TPoint[],
  polygonFeature: AreaFeature
): TPoint[] {
  const type = polygonFeature.geometry.type;
  if (type === 'Polygon') {
    const polygon = polygonFeature as PolygonFeature;
    return pointFeatures.filter((feature) =>
      isPointInPolygonCoordinates(feature.geometry.coordinates, polygon.geometry.coordinates)
    );
  }
  if (type === 'MultiPolygon') {
    const multiPolygon = polygonFeature as MultiPolygonFeature;
    return pointFeatures.filter((feature) =>
      multiPolygon.geometry.coordinates.some((polygon) =>
        isPointInPolygonCoordinates(feature.geometry.coordinates, polygon)
      )
    );
  }
  throw new Error('面类型必须是Polygon或MultiPolygon类型！');
}

function isPointInPolygonCoordinates(point: readonly number[], polygon: PolygonCoordinates): boolean {
  for (let i = 1; i < polygon.length; i++) {
    if (isPointInRingWithoutIndexes(point, polygon[i]) !== -1) {
      return false;
    }
  }
  return isPointInRingWithoutIndexes(point, polygon[0]) !== -1;
}

function isPointInIndexedPolygon(
  pointFeature: PointFeature,
  ringsTree: RBush<RingTreeItem>,
  rings: Record<string, RingIndex>
): boolean {
  const ringSearch = ringsTree.search(pointBBox(pointFeature));
  if (ringSearch.length === 0) {
    return false;
  }
  return evaluateCandidateRings(
    pointFeature.geometry.coordinates,
    ringSearch.map((item) => rings[item.ringId])
  );
}

function isPointInIndexedMultiPolygon(
  pointFeature: PointFeature,
  ringsTree: RBush<RingTreeItem>,
  rings: Record<string, RingIndex>
): boolean {
  const ringSearch = ringsTree.search(pointBBox(pointFeature));
  if (ringSearch.length === 0) {
    return false;
  }

  const polygonRings = new Map<number, RingIndex[]>();
  for (const item of ringSearch) {
    const ring = rings[item.ringId];
    const group = polygonRings.get(ring.polygonId);
    if (group) {
      group.push(ring);
    } else {
      polygonRings.set(ring.polygonId, [ring]);
    }
  }

  for (const searchedRings of polygonRings.values()) {
    if (evaluateCandidateRings(pointFeature.geometry.coordinates, searchedRings)) {
      return true;
    }
  }
  return false;
}

function evaluateCandidateRings(point: readonly number[], candidateRings: readonly RingIndex[]): boolean {
  let shellMatched = false;

  for (const ring of candidateRings) {
    const containment = classifyRingContainment(point, ring);
    if (
      containment === RingContainment.InsideHole ||
      containment === RingContainment.OutsideShell
    ) {
      return false;
    }
    if (containment === RingContainment.InsideShell) {
      shellMatched = true;
    }
  }

  return shellMatched;
}

function classifyRingContainment(point: readonly number[], ring: RingIndex): RingContainment {
  const containsPoint = isPointInRingWithIndexes(point, ring.segmentIndex) !== -1;

  if (ring.role === RingRole.Shell) {
    return containsPoint ? RingContainment.InsideShell : RingContainment.OutsideShell;
  }

  return containsPoint ? RingContainment.InsideHole : RingContainment.OutsideHole;
}

function getPolygonIndex(polygon: PolygonCoordinates): GeometryIndex {
  const ringsTree = new RBush<RingTreeItem>();
  const rings: Record<string, RingIndex> = {};

  for (let i = 0; i < polygon.length; i++) {
    const ring = polygon[i];
    const ringId = String(i);
    const { ringIndex, segmentIndex } = getRingIndex(ring);
    ringsTree.insert({ ...ringIndex, ringId });
    rings[ringId] = {
      ringId,
      segmentIndex,
      role: resolveRingRole(i),
      polygonId: 0,
    };
  }

  return { ringsTree, rings };
}

function getMultiPolygonIndex(multiPolygon: readonly PolygonCoordinates[]): GeometryIndex {
  const ringsTree = new RBush<RingTreeItem>();
  const rings: Record<string, RingIndex> = {};

  for (let i = 0; i < multiPolygon.length; i++) {
    const polygon = multiPolygon[i];
    for (let j = 0; j < polygon.length; j++) {
      const ring = polygon[j];
      const ringId = `${i}-${j}`;
      const { ringIndex, segmentIndex } = getRingIndex(ring);
      ringsTree.insert({ ...ringIndex, ringId });
      rings[ringId] = {
        ringId,
        segmentIndex,
        role: resolveRingRole(j),
        polygonId: i,
      };
    }
  }

  return { ringsTree, rings };
}

function resolveRingRole(ringIndex: number): RingRole {
  return ringIndex === 0 ? RingRole.Shell : RingRole.Hole;
}

function getRingIndex(ring: LinearRing): { ringIndex: BBox; segmentIndex: RBush<SegmentItem> } {
  const segmentIndex = new RBush<SegmentItem>();
  const n = ring.length;
  const ringIndex: BBox = {
    minX: Math.min(ring[0][0], ring[n - 1][0]),
    minY: Math.min(ring[0][1], ring[n - 1][1]),
    maxX: Math.max(ring[0][0], ring[n - 1][0]),
    maxY: Math.max(ring[0][1], ring[n - 1][1]),
  };

  for (let i = 1; i < n; i++) {
    const start = ring[i - 1];
    const end = ring[i];
    segmentIndex.insert({
      minX: Math.min(start[0], end[0]),
      minY: Math.min(start[1], end[1]),
      maxX: Math.max(start[0], end[0]),
      maxY: Math.max(start[1], end[1]),
      start,
      end,
    });
    ringIndex.minX = Math.min(ringIndex.minX, end[0]);
    ringIndex.minY = Math.min(ringIndex.minY, end[1]);
    ringIndex.maxX = Math.max(ringIndex.maxX, end[0]);
    ringIndex.maxY = Math.max(ringIndex.maxY, end[1]);
  }

  return { ringIndex, segmentIndex };
}

function pointBBox(pointFeature: PointFeature): BBox {
  const [x, y] = pointFeature.geometry.coordinates;
  return {
    minX: x,
    minY: y,
    maxX: x,
    maxY: y,
  };
}

export default pointWithinPolygon;
