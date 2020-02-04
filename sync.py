import os

import csv
import requests

import conf


def sync(token):
    headers = {"Authorization": "Bearer {0}".format(token)}
    f = conf.ride_file
    if not os.path.exists(f):
        open(f, "w")

    mode = "w" if os.stat(f).st_size == 0 else "a"
    ids = []
    with open(f, "r") as rides_file:
        reader = csv.DictReader(rides_file)
        for row in reader:
            ids.append(int(row["id"]))

    with open(f, mode) as rides_file:
        writer = csv.writer(rides_file, delimiter=",")
        if mode == 'w':
            writer.writerow(["id", "title", "dist", "date", "max", "avg", "net", "gross", "elev", "polyline"])
        page = 1
        while True:
            r = requests.get("https://www.strava.com/api/v3/athlete/activities?page={0}".format(page), headers=headers)
            response = r.json()

            if len(response) == 0:
                break
            else:
                for activity in [a for a in response if a['type'] == 'Ride' and a['id'] not in ids]:
                    r = requests.get("https://www.strava.com/api/v3/activities/{0}?include_all_efforts=true"
                                     .format(int(activity["id"])), headers=headers)
                    json = r.json()

                    _id = activity["id"]
                    title = json["name"]
                    dist = json["distance"]
                    date = json["start_date_local"]
                    _max = json["max_speed"]
                    avg = json["average_speed"]
                    net = json["moving_time"]
                    gross = json["elapsed_time"]
                    elev = json["total_elevation_gain"]
                    polyline = json["map"]["polyline"]
                    writer.writerow([_id, title, dist, date, _max, avg, net, gross, elev, polyline])
                page += 1
