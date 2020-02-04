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
        return {'coordinates': [tl, bl, br, tr]}

    @staticmethod
    def x2lng(x): return x / N * 360.0 - 180.0

    @staticmethod
    def y2lat(y): return math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / N))))

    def __eq__(self, other):
        return self.x == other.x and self.y == other.y

    def __hash__(self):
        return hash((self.x, self.y))


class Line:
    def __init__(self, x1, y1, x2, y2):
        self.p1, self.p2 = Point(x1, y1), Point(x2, y2)

    def intersects(self, line):
        def ccw(a, b, c):
            return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x)

        return ccw(self.p1, line.p1, line.p2) != ccw(self.p2, line.p1, line.p2) and \
               ccw(self.p1, self.p2, line.p1) != ccw(self.p1, self.p2, line.p2)


def window(it, size): yield from zip(
    *[islice(it, s, None) for s, it in enumerate(tee(it, size))]
)


def tiles(ride):
    coordinates = [Coord(lat, lng) for (lat, lng) in ride['route']]
    ts = set()

    def add_tile(point):
        ts.add(Tile(point.x, point.y))

    add_tile(coordinates[0])
    for a, b in window(coordinates, size=2):
        add_tile(b)
        # Check for extra visited tiles situated between coordinates that are from two diagonally placed tiles
        # Might be that no coordinates for such tile were recorded during a short visit so we need to interpolate
        if abs(a.x - b.x) == 1 and abs(a.y - b.y) == 1:
            neighbors = [Tile(a.x - 1, a.y), Tile(a.x + 1, a.y), Tile(a.x, a.y + 1), Tile(a.x, a.y - 1)]
            ab = Line(a.lng, a.lat, b.lng, b.lat)
            for tile in neighbors:
                top = Line(tile.left, tile.top, tile.right, tile.top)
                bottom = Line(tile.left, tile.bottom, tile.right, tile.bottom)
                right = Line(tile.right, tile.top, tile.right, tile.bottom)
                left = Line(tile.left, tile.top, tile.left, tile.bottom)
                if len([t for t in [top, bottom, right, left] if ab.intersects(t)]) == 2:
                    # take the tile if line a-b intersects it twice
                    add_tile(Point(tile.x, tile.y))
    return ts


def flatten(xs): return [item for sublist in xs for item in sublist]


def max_cluster(ts, start):
    def neighbors(t):
        return [Tile(t.x, t.y - 1), Tile(t.x + 1, t.y), Tile(t.x, t.y + 1), Tile(t.x - 1, t.y)]

    def valid(t):
        return len([n for n in neighbors(t) if n in ts]) == 4

    def bfs():
        seen = {start}
        q = [start]
        while q:
            for n in [n for n in neighbors(q.pop(0)) if n not in seen and valid(n)]:
                q.append(n)
                seen.add(n)
        return seen

    return bfs()


def max_block(ts, start, size=conf.max_square_bounds):
    w = int(size / 2)
    mat = [[1 if Tile(x, y) in ts else 0 for x in range(start.x - w, start.x + w)]
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
    all_tiles = [t for t in flatten([r for r in rides])]
    most_visited, _ = Counter(all_tiles).most_common(1)[0]
    return most_visited, set(all_tiles)
