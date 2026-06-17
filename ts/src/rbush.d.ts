declare module 'rbush' {
  export interface BBox {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }

  export default class RBush<TItem extends BBox = BBox> {
    constructor(maxEntries?: number);
    insert(item: TItem): this;
    load(data: TItem[]): this;
    search(bbox: BBox): TItem[];
    collides(bbox: BBox): boolean;
    all(): TItem[];
    remove(item: TItem, equals?: (a: TItem, b: TItem) => boolean): this;
    clear(): this;
    toJSON(): unknown;
    fromJSON(data: unknown): this;
  }
}
