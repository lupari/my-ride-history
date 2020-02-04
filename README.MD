My Ride History
===============
This is a hobby project I built so I can nicely keep track of where I've ridden.  On top of that this app calculates and displays the ~square kilometer sized tiles (OSM tile zoom level 14) visited and based on those it also displays the largest tile cluster and maximum tile square. 

Ride data comes through Strava's API and for accessing it you need to create a Strava API account. See https://developers.strava.com/ for details. Server is implemented as a [Flask](https://www.palletsprojects.com/p/flask/) application whereas client relies heavily on [Leaflet.js](https://leafletjs.com/) and [Open Street Maps](https://www.openstreetmap.org/).

## Configuration
You need to create a `conf.py` configuration file under project root. 
A sample file could look like this:

```
auth_username = 'my username'  # Basic auth username, protects ride data sync related resources
auth_pwd = 'my password'  # Basic auth password, protects ride data sync related resources
client_id = 12345  # Your Strava API client ID
client_secret = 'secret'  # Your Strava API client secret
debug = False  # Run Flask in debug mode, affects hot deployment etc
hostname = 'http://localhost:5001'  # Used by Strava so it can redirect back to your site after OAuth
ride_file = 'rides.csv'  # Path to file where you want to locally store your ride data
port = 5001  #  Port assigned for this app
```
Your hostname should be explicitly whitelisted in Strava API settings for redirection to work. Localhost is an exception to the rule, it is automatically whitelisted. Note that you should really use HTTPS with basic auth at least if the app is deployed outside localhost.

## Syncing your local data with Strava
Just navigate to `/sync` with your browser, enter your basic auth credentials (see above) and  you're forwarded to Strava OAuth screen. Allow access and soon you should be all set up. Note that depending on the amount of data you have the initial sync could take some time.
