import csv
import json
import os

from flask import Flask, redirect, render_template, request
from flask_basicauth import BasicAuth
from flask_caching import Cache
import polyline
import requests

import conf
from sync import sync
import tiles

app = Flask(__name__)
app.config.from_mapping({'CACHE_TYPE': 'simple', 'CACHE_DEFAULT_TIMEOUT': 300})
app.config.from_mapping({'BASIC_AUTH_USERNAME': conf.auth_username, 'BASIC_AUTH_PASSWORD': conf.auth_pwd})
cache = Cache(app)
basic_auth = BasicAuth(app)

CLIENT_ID = conf.client_id
CLIENT_SECRET = conf.client_secret
REDIRECT = conf.hostname + '/sync2'
EXT_API = 'https://www.strava.com'


@app.route('/sync')
@basic_auth.required
def sync_rides():
    url = '%s/oauth/authorize?client_id=%s&redirect_uri=%s&response_type=code&scope=activity:read' \
          % (EXT_API, CLIENT_ID, REDIRECT)
    return redirect(url)


@app.route('/sync2')
@basic_auth.required
def authorized():
    if 'error' in request.args:
        return redirect('/')
    auth_code = request.args['code']
    url = '%s/oauth/token?client_id=%s&client_secret=%s&code=%s&grant_type=authorization_code' \
          % (EXT_API, CLIENT_ID, CLIENT_SECRET, auth_code)
    r = requests.post(url)
    response = r.json()
    sync(response['access_token'])
    cache.clear()
    return redirect('/')


@app.route('/')
@cache.cached(timeout=0)
def my_rides():
    rides, all_tiles, cluster, max_square, w = [], [], [], [], 0
    if os.path.exists(conf.ride_file):
        with open(conf.ride_file, 'r') as rides_file:
            reader = csv.DictReader(rides_file)
            for row in reader:
                row['route'] = polyline.decode(row['polyline'])
                rides.append(row)
    if len(rides) > 0:
        most_visited, all_tiles = tiles.union([tiles.tiles(ride) for ride in rides])
        max_square, w = tiles.max_square(all_tiles, most_visited)
        cluster = tiles.max_cluster(all_tiles, tiles.Tile(most_visited.x + int(w / 2), most_visited.y + int(w / 2)))
        for r in rides:
            # redo route point decoding on browser, amount of data is huge and takes time/bandwidth if transmitted
            del r['route']

    return render_template('app.html.j2', rides=json.dumps(rides),
                           tiles=json.dumps([t.polygon() for t in all_tiles]),
                           cluster=json.dumps([t.polygon() for t in cluster]),
                           max_square=json.dumps({'shape': max_square, 'l': w}))


if __name__ == "__main__":
    app.run(port=conf.port, debug=conf.debug)
