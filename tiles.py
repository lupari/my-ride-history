from collections import Counter
from itertools import islice, tee
import math

import conf

# tile calculus functions: https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
Z = 14
N = 2.0 ** Z


class Point:
    def __init__(self, x, y):
        self.x, self.y = x, y

    def key(self):
        return '%s-%s' % (self.x, self.y)


class Coord(Point):
    def __init__(self, lat, lng):
        super().__init__(Coord.lng2x(lng), Coord.lat2y(lat))
        self.lat, self.lng = lat, lng

    @staticmethod
    def lng2x(lng): return int((lng + 180) / 360 * N)

    @staticmethod
    def lat2y(lat): return int((1.0 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2.0 * N)


class Tile(Point):
    def __init__(self, x, y):
        super().__init__(x, y)
        self.top, self.bottom = Tile.y2lat(y), Tile.y2lat(y + 1)
        self.left, self.right = Tile.x2lng(x), Tile.x2lng(x + 1)
        self.tl, self.br = Point(self.left, self.top), Point(self.right, self.bottom)

    def polygon(self):
        tl = [self.tl.y, self.tl.x]
        bl = [self.tl.y, self.br.x]
        br = [self.br.y, self.br.x]
        tr = [self.br.y, self.tl.x]
        return {'coordinates': [tl, bl, br, tr], 'label': self.key()}

    @staticmethod
    def x2lng(x): return x / N * 360.0 - 180.0

    @staticmethod
    def y2lat(y): return math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / N))))


def window(it, size): yield from zip(
    *[islice(it, s, None) for s, it in enumerate(tee(it, size))]
)


def intersects(p1, p2, p3, p4):
    def ccw(a, b, c):
        return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x)

    return ccw(p1, p3, p4) != ccw(p2, p3, p4) and ccw(p1, p2, p3) != ccw(p1, p2, p4)


def tiles(ride):
    coordinates = [Coord(lat, lng) for (lat, lng) in ride['route']]
    t = {}

    def add_tile(point):
        t[point.key()] = Tile(point.x, point.y)

    add_tile(coordinates[0])
    for a, b in window(coordinates, size=2):
        add_tile(b)
        # Check for extra visited tiles situated between coordinates that are from two diagonally placed tiles
        # Might be that no coordinates for such tile were recorded during a short visit so we need to interpolate
        if abs(a.x - b.x) == 1 and abs(a.y - b.y) == 1:
            neighbors = [Tile(a.x - 1, a.y), Tile(a.x + 1, a.y), Tile(a.x, a.y + 1), Tile(a.x, a.y - 1)]
            pa, pb = Point(a.lng, a.lat), Point(b.lng, b.lat)
            for tile in neighbors:
                top = intersects(pa, pb, Point(tile.left, tile.top), Point(tile.right, tile.top))
                bottom = intersects(pa, pb, Point(tile.left, tile.bottom), Point(tile.right, tile.bottom))
                right = intersects(pa, pb, Point(tile.right, tile.top), Point(tile.right, tile.bottom))
                left = intersects(pa, pb, Point(tile.left, tile.top), Point(tile.left, tile.bottom))
                if top + bottom + right + left == 2:  # take the tile if line a-b intersects it twice
                    add_tile(Point(tile.x, tile.y))
    return t


def flatten(xs): return [item for sublist in xs for item in sublist]


def max_cluster(coordinates, start):
    def neighbors(t):
        return [Tile(t.x, t.y - 1), Tile(t.x + 1, t.y), Tile(t.x, t.y + 1), Tile(t.x - 1, t.y)]

    def valid(t):
        return len([n for n in neighbors(t) if n.key() in [c['label'] for c in coordinates]]) == 4

    def bfs():
        seen = {start.key(): start}
        q = [start]
        while q:
            for n in [n for n in neighbors(q.pop(0)) if n.key() not in seen and valid(n)]:
                q.append(n)
                seen[n.key()] = n
        return seen.values()

    return [t.polygon() for t in bfs()]


def max_block(coordinates, start, size=conf.max_square_bounds):
    w = int(size / 2)
    labels = [c['label'] for c in coordinates]
    mat = [[1 if '%s-%s' % (x, y) in labels else 0 for x in range(start.x - w, start.x + w)]
           for y in range(start.y - w, start.y + w)]

    def search(label=1):
        nr, nc = len(mat), len(mat[0])
        ms, loc = 0, Point(0, 0)
        counts = [[0] * nc for _ in range(nr)]
        for i, j in ((r, c) for r in reversed(range(nr)) for c in reversed(range(nc))):
            if mat[i][j] == label:
                counts[i][j] = (1 + min(
                    counts[i][j + 1],  # east
                    counts[i + 1][j],  # south
                    counts[i + 1][j + 1]  # south-east
                )) if i < (nr - 1) and j < (nc - 1) else 1  # edges
                if counts[i][j] > ms:
                    ms = counts[i][j]
                    loc = Point(start.x - w + j, start.y - w + i)
        return ms, loc

    h, tl = search()

    return [
               [Tile.y2lat(tl.y), Tile.x2lng(tl.x)],
               [Tile.y2lat(tl.y), Tile.x2lng(tl.x + h)],
               [Tile.y2lat(tl.y + h), Tile.x2lng(tl.x + h)],
               [Tile.y2lat(tl.y + h), Tile.x2lng(tl.x)],
           ], h


def union(rides):
    all_tiles = [t for t in flatten([r.values() for r in rides])]
    (mv_x, mv_y), _ = Counter([(t.x, t.y) for t in all_tiles]).most_common(1)[0]
    unique_tiles = {t.key(): t for t in all_tiles}
    return Tile(mv_x, mv_y), [t.polygon() for t in unique_tiles.values()]
