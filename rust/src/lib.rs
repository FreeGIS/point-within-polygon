use std::collections::HashMap;
use std::fmt;

use geo_index::rtree::sort::HilbertSort;
use geo_index::rtree::{RTree, RTreeBuilder, RTreeIndex};

const RAY_LENGTH: f64 = 1_000_000_000.0;

pub type Position = [f64; 2];
pub type LinearRing = Vec<Position>;
pub type Polygon = Vec<LinearRing>;
pub type MultiPolygon = Vec<Polygon>;

#[derive(Debug, Clone, PartialEq)]
pub enum AreaGeometry {
    Polygon(Polygon),
    MultiPolygon(MultiPolygon),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PointWithinPolygonError {
    EmptyRing,
    RingTooShort { length: usize },
    TooManyIndexedItems { count: usize },
}

impl fmt::Display for PointWithinPolygonError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::EmptyRing => write!(f, "ring must contain at least one coordinate"),
            Self::RingTooShort { length } => {
                write!(
                    f,
                    "ring must contain at least two coordinates, got {length}"
                )
            }
            Self::TooManyIndexedItems { count } => {
                write!(f, "geo-index supports at most u32::MAX items, got {count}")
            }
        }
    }
}

impl std::error::Error for PointWithinPolygonError {}

#[derive(Debug)]
pub struct PointWithinPolygon {
    multi_polygon: bool,
    rings_tree: RTree<f64>,
    rings: Vec<RingIndex>,
}

impl PointWithinPolygon {
    pub fn new(area: AreaGeometry) -> Result<Self, PointWithinPolygonError> {
        let mut rings = Vec::new();
        let multi_polygon = matches!(area, AreaGeometry::MultiPolygon(_));

        match area {
            AreaGeometry::Polygon(polygon) => {
                build_polygon_index(&polygon, 0, &mut rings)?;
            }
            AreaGeometry::MultiPolygon(multi_polygon) => {
                for (polygon_id, polygon) in multi_polygon.iter().enumerate() {
                    build_polygon_index(polygon, polygon_id, &mut rings)?;
                }
            }
        }

        let mut rings_builder = RTreeBuilder::<f64>::new(usize_to_u32(rings.len())?);
        for ring in &rings {
            rings_builder.add(
                ring.envelope.min_x,
                ring.envelope.min_y,
                ring.envelope.max_x,
                ring.envelope.max_y,
            );
        }

        Ok(Self {
            multi_polygon,
            rings_tree: rings_builder.finish::<HilbertSort>(),
            rings,
        })
    }

    pub fn from_polygon(polygon: Polygon) -> Result<Self, PointWithinPolygonError> {
        Self::new(AreaGeometry::Polygon(polygon))
    }

    pub fn from_multi_polygon(
        multi_polygon: MultiPolygon,
    ) -> Result<Self, PointWithinPolygonError> {
        Self::new(AreaGeometry::MultiPolygon(multi_polygon))
    }

    pub fn contains(&self, point: Position) -> bool {
        if self.multi_polygon {
            self.is_point_in_multi_polygon(point)
        } else {
            self.is_point_in_polygon(point)
        }
    }

    pub fn filter<'a>(&self, points: &'a [Position]) -> Vec<&'a Position> {
        points
            .iter()
            .filter(|point| self.contains(**point))
            .collect()
    }

    pub fn filter_copied(&self, points: &[Position]) -> Vec<Position> {
        points
            .iter()
            .copied()
            .filter(|point| self.contains(*point))
            .collect()
    }

    fn is_point_in_polygon(&self, point: Position) -> bool {
        let candidate_ring_ids = self.query_rings(point);
        if candidate_ring_ids.is_empty() {
            return false;
        }

        let candidate_rings = candidate_ring_ids
            .iter()
            .map(|ring_id| &self.rings[*ring_id as usize])
            .collect::<Vec<_>>();
        evaluate_candidate_rings(point, &candidate_rings)
    }

    fn is_point_in_multi_polygon(&self, point: Position) -> bool {
        let candidate_ring_ids = self.query_rings(point);
        if candidate_ring_ids.is_empty() {
            return false;
        }

        let mut polygon_rings: HashMap<usize, Vec<&RingIndex>> = HashMap::new();
        for ring_id in candidate_ring_ids {
            let ring = &self.rings[ring_id as usize];
            polygon_rings.entry(ring.polygon_id).or_default().push(ring);
        }

        polygon_rings
            .values()
            .any(|candidate_rings| evaluate_candidate_rings(point, candidate_rings))
    }

    fn query_rings(&self, point: Position) -> Vec<u32> {
        self.rings_tree
            .search(point[0], point[1], point[0], point[1])
    }
}

#[derive(Debug)]
struct RingIndex {
    polygon_id: usize,
    role: RingRole,
    envelope: BBox,
    segment_index: RTree<f64>,
    segments: Vec<Segment>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum RingRole {
    Shell,
    Hole,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum RingContainment {
    OutsideShell,
    InsideShell,
    InsideHole,
    OutsideHole,
}

#[derive(Debug, Clone, Copy)]
struct BBox {
    min_x: f64,
    min_y: f64,
    max_x: f64,
    max_y: f64,
}

#[derive(Debug, Clone, Copy)]
struct Segment {
    start: Position,
    end: Position,
}

fn build_polygon_index(
    polygon: &Polygon,
    polygon_id: usize,
    rings: &mut Vec<RingIndex>,
) -> Result<(), PointWithinPolygonError> {
    for (ring_index, ring) in polygon.iter().enumerate() {
        rings.push(build_ring_index(
            ring,
            polygon_id,
            resolve_ring_role(ring_index),
        )?);
    }
    Ok(())
}

fn build_ring_index(
    ring: &LinearRing,
    polygon_id: usize,
    role: RingRole,
) -> Result<RingIndex, PointWithinPolygonError> {
    let envelope = ring_bbox(ring)?;
    let mut segments = Vec::with_capacity(ring.len().saturating_sub(1));
    for window in ring.windows(2) {
        segments.push(Segment {
            start: window[0],
            end: window[1],
        });
    }

    let mut segment_builder = RTreeBuilder::<f64>::new(usize_to_u32(segments.len())?);
    for segment in &segments {
        let bbox = segment_bbox(*segment);
        segment_builder.add(bbox.min_x, bbox.min_y, bbox.max_x, bbox.max_y);
    }

    Ok(RingIndex {
        polygon_id,
        role,
        envelope,
        segment_index: segment_builder.finish::<HilbertSort>(),
        segments,
    })
}

fn evaluate_candidate_rings(point: Position, candidate_rings: &[&RingIndex]) -> bool {
    let mut shell_matched = false;

    for ring in candidate_rings {
        match classify_ring_containment(point, ring) {
            RingContainment::InsideHole | RingContainment::OutsideShell => return false,
            RingContainment::InsideShell => shell_matched = true,
            RingContainment::OutsideHole => {}
        }
    }

    shell_matched
}

fn classify_ring_containment(point: Position, ring: &RingIndex) -> RingContainment {
    let contains_point = is_point_in_ring_with_index(point, ring) != -1.0;

    match ring.role {
        RingRole::Shell => {
            if contains_point {
                RingContainment::InsideShell
            } else {
                RingContainment::OutsideShell
            }
        }
        RingRole::Hole => {
            if contains_point {
                RingContainment::InsideHole
            } else {
                RingContainment::OutsideHole
            }
        }
    }
}

fn is_point_in_ring_with_index(point: Position, ring: &RingIndex) -> f64 {
    let segment_ids =
        ring.segment_index
            .search(point[0], point[1], point[0] + RAY_LENGTH, point[1]);
    let mut x_intersect = None;
    let mut intersects = 0usize;

    for segment_id in segment_ids {
        let segment = ring.segments[segment_id as usize];
        if segment_contains(segment.start, segment.end, point) {
            return -1.0;
        }
        if segment.start[1] == segment.end[1] {
            continue;
        }

        let x = ((point[1] - segment.start[1]) * (segment.end[0] - segment.start[0]))
            / (segment.end[1] - segment.start[1])
            + segment.start[0];
        if x <= point[0] {
            continue;
        }
        if x_intersect.map_or(true, |current| current > x) {
            x_intersect = Some(x);
        }

        if x == segment.start[0] && point[1] == segment.start[1] {
            if point[1] > segment.end[1] {
                intersects += 1;
            }
        } else if x == segment.end[0] && point[1] == segment.end[1] {
            if point[1] > segment.start[1] {
                intersects += 1;
            }
        } else {
            intersects += 1;
        }
    }

    if intersects % 2 == 1 {
        x_intersect.unwrap_or(-1.0)
    } else {
        -1.0
    }
}

fn resolve_ring_role(ring_index: usize) -> RingRole {
    if ring_index == 0 {
        RingRole::Shell
    } else {
        RingRole::Hole
    }
}

fn ring_bbox(ring: &LinearRing) -> Result<BBox, PointWithinPolygonError> {
    if ring.is_empty() {
        return Err(PointWithinPolygonError::EmptyRing);
    }
    if ring.len() < 2 {
        return Err(PointWithinPolygonError::RingTooShort { length: ring.len() });
    }

    let mut bbox = BBox {
        min_x: ring[0][0].min(ring[ring.len() - 1][0]),
        min_y: ring[0][1].min(ring[ring.len() - 1][1]),
        max_x: ring[0][0].max(ring[ring.len() - 1][0]),
        max_y: ring[0][1].max(ring[ring.len() - 1][1]),
    };

    for position in &ring[1..] {
        bbox.min_x = bbox.min_x.min(position[0]);
        bbox.min_y = bbox.min_y.min(position[1]);
        bbox.max_x = bbox.max_x.max(position[0]);
        bbox.max_y = bbox.max_y.max(position[1]);
    }

    Ok(bbox)
}

fn segment_bbox(segment: Segment) -> BBox {
    BBox {
        min_x: segment.start[0].min(segment.end[0]),
        min_y: segment.start[1].min(segment.end[1]),
        max_x: segment.start[0].max(segment.end[0]),
        max_y: segment.start[1].max(segment.end[1]),
    }
}

fn segment_contains(a: Position, b: Position, c: Position) -> bool {
    let axis = if a[0] == b[0] { 1 } else { 0 };
    collinear(a, b, c) && within(a[axis], c[axis], b[axis])
}

fn collinear(a: Position, b: Position, c: Position) -> bool {
    (b[0] - a[0]) * (c[1] - a[1]) == (c[0] - a[0]) * (b[1] - a[1])
}

fn within(p: f64, q: f64, r: f64) -> bool {
    (p <= q && q <= r) || (r <= q && q <= p)
}

fn usize_to_u32(count: usize) -> Result<u32, PointWithinPolygonError> {
    u32::try_from(count).map_err(|_| PointWithinPolygonError::TooManyIndexedItems { count })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn filters_points_inside_polygon_and_excludes_hole() {
        let index = PointWithinPolygon::from_polygon(vec![
            vec![[0.0, 0.0], [4.0, 0.0], [4.0, 4.0], [0.0, 4.0], [0.0, 0.0]],
            vec![[1.0, 1.0], [3.0, 1.0], [3.0, 3.0], [1.0, 3.0], [1.0, 1.0]],
        ])
        .unwrap();

        assert!(index.contains([0.5, 0.5]));
        assert!(!index.contains([2.0, 2.0]));
        assert!(!index.contains([5.0, 5.0]));
        assert!(!index.contains([0.0, 1.0]));
    }

    #[test]
    fn keeps_multi_polygon_rings_grouped_by_polygon() {
        let index = PointWithinPolygon::from_multi_polygon(vec![
            vec![vec![
                [0.0, 0.0],
                [2.0, 0.0],
                [2.0, 2.0],
                [0.0, 2.0],
                [0.0, 0.0],
            ]],
            vec![vec![
                [0.0, 0.0],
                [4.0, 0.0],
                [4.0, 4.0],
                [3.0, 4.0],
                [3.0, 1.0],
                [1.0, 1.0],
                [1.0, 4.0],
                [0.0, 4.0],
                [0.0, 0.0],
            ]],
        ])
        .unwrap();

        let named_points = [
            ("inside first only", [1.0, 1.0]),
            ("inside second", [3.5, 0.5]),
            ("outside both", [2.5, 2.0]),
            ("boundary", [0.0, 1.0]),
        ];

        let names = named_points
            .iter()
            .filter(|(_, point)| index.contains(*point))
            .map(|(name, _)| *name)
            .collect::<Vec<_>>();

        assert_eq!(names, vec!["inside first only", "inside second"]);
    }

    #[test]
    fn filters_points_in_batch() {
        let index = PointWithinPolygon::from_polygon(vec![vec![
            [0.0, 0.0],
            [2.0, 0.0],
            [2.0, 2.0],
            [0.0, 2.0],
            [0.0, 0.0],
        ]])
        .unwrap();
        let points = [[1.0, 1.0], [3.0, 3.0]];

        assert_eq!(index.filter_copied(&points), vec![[1.0, 1.0]]);
    }
}
