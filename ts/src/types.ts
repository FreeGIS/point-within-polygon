export type Position = readonly number[];
export type LinearRing = readonly Position[];
export type PolygonCoordinates = readonly LinearRing[];
export type MultiPolygonCoordinates = readonly PolygonCoordinates[];

export interface PointGeometry {
  type: 'Point';
  coordinates: Position;
}

export interface PolygonGeometry {
  type: 'Polygon';
  coordinates: PolygonCoordinates;
}

export interface MultiPolygonGeometry {
  type: 'MultiPolygon';
  coordinates: MultiPolygonCoordinates;
}

export interface Feature<
  TGeometry extends { type: string },
  TProperties = Record<string, unknown>
> {
  type: 'Feature';
  properties: TProperties;
  geometry: TGeometry;
  [key: string]: unknown;
}

export type PointFeature<TProperties = Record<string, unknown>> = Feature<
  PointGeometry,
  TProperties
>;

export type PolygonFeature<TProperties = Record<string, unknown>> = Feature<
  PolygonGeometry,
  TProperties
>;

export type MultiPolygonFeature<TProperties = Record<string, unknown>> = Feature<
  MultiPolygonGeometry,
  TProperties
>;

export type AreaFeature<TProperties = Record<string, unknown>> =
  | PolygonFeature<TProperties>
  | MultiPolygonFeature<TProperties>;

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface SegmentItem extends BBox {
  start: Position;
  end: Position;
}

export interface RingTreeItem extends BBox {
  ringId: string;
}
