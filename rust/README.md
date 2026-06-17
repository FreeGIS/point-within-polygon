# point-within-polygon-rs

Rust implementation of the point-within-polygon algorithm used by the TypeScript and Java versions in this repository.

The crate builds immutable spatial indexes with `geo-index`:

- one R-tree for candidate rings
- one R-tree per ring for candidate segments

Boundary points are treated as outside, matching the TypeScript implementation.

## Usage

```rust
use point_within_polygon_rs::{PointWithinPolygon, Polygon};

let polygon: Polygon = vec![vec![
    [0.0, 0.0],
    [1.0, 0.0],
    [1.0, 1.0],
    [0.0, 1.0],
    [0.0, 0.0],
]];

let index = PointWithinPolygon::from_polygon(polygon).unwrap();
assert!(index.contains([0.5, 0.5]));
```
