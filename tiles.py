from collections import Counter
from itertools import islice, tee
import math

import conf

# tile calculus functions: https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
N = 2.0 ** 14


def lng2x(lng): return int((lng + 180) / 360 * N)


def lat2y(lat): return int((1.0 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2.0 * N)


def x2lng(x): return x / N * 360.0 - 180.0


def y2lat(y): return math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / N))))


class Point:
    def __init__(self, x, y):
        self.x, self.y = x, y


class Coord(Point):
    def __init__(self, lat, lng):
        super().__init__(lng2x(lng), lat2y(lat))
        self.lat, self.lng = lat, lng


class Tile(Point):
    def __init__(self, x, y):
        super().__init__(x, y)
        top, bottom = y2lat(y), y2lat(y + 1)
        left, right = x2lng(x), x2lng(x + 1)
        self.tl, self.br = Point(left, top), Point(right, bottom)
        self.tr, self.bl = Point(right, top), Point(left, bottom)

    def neighbors(self):
        return [Tile(self.x + i, self.y + j) for i, j in [(-1, 0), (1, 0), (0, 1), (0, -1)]]

    def edges(self):
        return [Line(self.tl, self.tr), Line(self.bl, self.br), Line(self.tr, self.br), Line(self.tl, self.bl)]

    def polygon(self):
        tl = [self.tl.y, self.tl.x]
        bl = [self.tl.y, self.br.x]
        br = [self.br.y, self.br.x]
        tr = [self.br.y, self.tl.x]
        return {'coordinates': [tl, bl, br, tr]}

    def square(self, h):
        return [[self.tl.y, self.tl.x],
                [self.tl.y, x2lng(self.x + h)],
                [y2lat(self.y + h), x2lng(self.x + h)],
                [y2lat(self.y + h), self.tl.x]
                ]

    def __eq__(self, other):
        return self.x == other.x and self.y == other.y

    def __hash__(self):
        return hash((self.x, self.y))


class Line:
    def __init__(self, p1, p2):
        self.p1, self.p2 = p1, p2

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
    ts = {Tile(coordinates[0].x, coordinates[0].y)}
    for a, b in window(coordinates, size=2):
        ts.add(Tile(b.x, b.y))
        # Check for extra visited tiles situated between coordinates that are from two diagonally placed tiles
        # In case no coordinates for such tile were recorded during a short visit we might need to interpolate
        if abs(a.x - b.x) == 1 and abs(a.y - b.y) == 1:
            ab = Line(Point(a.lng, a.lat), Point(b.lng, b.lat))
            for tile in Tile(a.x, a.y).neighbors():
                if len([e for e in tile.edges() if ab.intersects(e)]) == 2:
                    # take the tile if line a-b intersects it twice
                    ts.add(tile)
    return ts


def flatten(xs): return [item for sublist in xs for item in sublist]


def max_cluster(ts, start):
    def surrounded(t):
        return len([n for n in t.neighbors() if n in ts]) == 4

    def bfs():
        seen, q = {start}, [start]
        while q:
            for n in [n for n in q.pop(0).neighbors() if n not in seen and surrounded(n)]:
                q.append(n)
                seen.add(n)
        return seen

    return bfs()


def max_square(ts, start, size):
    w = int(size / 2)
    m = [[1 if Tile(x, y) in ts else 0 for x in range(start.x - w, start.x + w)]
         for y in range(start.y - w, start.y + w)]

    def search():
        nr, nc = len(m), len(m[0])
        ms, loc = 0, Point(0, 0)
        counts = [[0] * nc for _ in range(nr)]
        for i, j in ((r, c) for r in reversed(range(nr)) for c in reversed(range(nc))):
            if m[i][j] == 1:
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
    return Tile(tl.x, tl.y).square(h), h


def union(rides):
    all_tiles = [t for t in flatten([r for r in rides])]
    most_visited, _ = Counter(all_tiles).most_common(1)[0]
    return most_visited, set(all_tiles)
