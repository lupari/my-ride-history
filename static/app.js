/**
 * @param {array} rides - rides
 * @param {array} tiles - 1*1 km tile coordinates
 * @param {object} square - coordinates for max square
 * @param {array} cluster - cluster coordinates
 * **/
function renderApp(rides, tiles, square, cluster) {
  const toDuration = (s) => {
    const hours = Math.floor(s / 3600);
    const mods = s % 3600;
    const minutes = Math.floor(mods / 60);
    const seconds = mods % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const routing = rides.map((ride) => L.polyline(
      ride.route,
      {
        color: 'blue',
        weight: 1,
        opacity: 0.7,
        lineJoin: 'round',
      },
  ).on({
    popupopen: (e) => e.target.setStyle(
        {color: 'red', weight: 5, opacity: 0.7}),
    popupclose: (e) => e.target.setStyle(
        {color: 'blue', weight: 1, opacity: 0.7}),
  }).bindPopup(
      `<strong>${ride.title}</strong><br />
           ${ride.date.slice(0, -1)}<br />
           ${(ride.dist / 1000.0).toFixed(2)} km<br />
           avg: ${((ride.avg / 1000.0) * 60 * 60).toFixed(2)} km/h<br />
           max: ${((ride.max / 1000.0) * 60 * 60).toFixed(2)} km/h<br />
           elevation: ${parseInt(ride.elev, 10)} m<br />
           ride time: ${toDuration(ride.net)}<br />
        total time: ${toDuration(ride.gross)}<br />
          `, {closeOnClick: false},
  ));

  // const points = rides.flatMap(r => r.route)
  //   .map(c => new L.Marker([c.lat, c.lng]).bindPopup(`${c.lat} ${c.lng}`))

  const tiling = tiles.map((t) => L.polygon(t.coordinates, {
    color: 'green',
    opacity: 0.5,
    weight: 0.5,
    fillColor: 'green',
    fillOpacity: 0.1,
    interactive: false,
  }));

  const maxSquare = L.polygon(
      square.shape, {
        color: 'blue',
        opacity: 0.5,
        weight: 0.5,
        fillColor: 'blue',
        fillOpacity: 0.1,
        interactive: false,
      },
  );

  const clustering = cluster.map((c) => L.polygon(c.coordinates, {
    color: 'red',
    opacity: 0.5,
    weight: 0.5,
    fillColor: 'red',
    fillOpacity: 0.1,
    interactive: false,
  }));

  lon2tile = (lon,zoom) => Math.floor((lon+180)/360*Math.pow(2,zoom));
  lat2tile = (lat,zoom) => Math.floor((1-Math.log(Math.tan(lat*Math.PI/180) + 1/Math.cos(lat*Math.PI/180))/Math.PI)/2 *Math.pow(2,zoom));
  tile2long = (x,z) => x/Math.pow(2,z)*360-180;
  tile2lat = (y,z) => {
      var n=Math.PI-2*Math.PI*y/Math.pow(2,z);
      return 180/Math.PI*Math.atan(0.5*(Math.exp(n)-Math.exp(-n)));
  }

  L.GridLayer.GridDebug = L.GridLayer.extend({  // TODO: make recursive or something
    createTile: function (coords) {
        const sz = this.getTileSize();
        const tile = L.DomUtil.create('canvas', 'leaflet-tile');
        var ctx = tile.getContext('2d');
        tile.width = sz.x;
        tile.height = sz.y;
        if (coords.z === 13) { // split in four
            ctx.rect(0, 0, sz.x/2, sz.y/2);
            ctx.rect(0, sz.y/2, sz.x/2, sz.y/2);
            ctx.rect(sz.x/2, 0, sz.x/2, sz.y/2);
            ctx.rect(sz.x/2, sz.y/2, sz.x/2, sz.y/2);
            ctx.stroke();
        } else if (coords.z === 14) { // nothing to do
            ctx.rect(0, 0, sz.x, sz.y);
            ctx.stroke();
        } else if (coords.z === 15) { // merge four into one
            const lon = tile2long(coords.x, coords.z);
            const lat = tile2lat(coords.y, coords.z);
            const z14x = lon2tile(lon, 14);
            const z14y = lat2tile(lat, 14);
            ctx.beginPath();
            if (z14x*2 === coords.x && z14y*2 === coords.y) {
                ctx.moveTo(0, 0);
                ctx.lineTo(0, sz.x);
                ctx.moveTo(0, 0);
                ctx.lineTo(sz.y, 0);
            } else if (z14x*2 + 1 === coords.x  && z14y*2 === coords.y) {
                ctx.moveTo(0, 0);
                ctx.lineTo(sz.x, 0);
                ctx.moveTo(sz.x, 0);
                ctx.lineTo(sz.x, sz.y);
            } else if (z14x*2 === coords.x && z14y*2 + 1 === coords.y) {
                ctx.moveTo(0, 0);
                ctx.lineTo(0, sz.y);
                ctx.moveTo(0, sz.y);
                ctx.lineTo(sz.x, sz.y);
            } else {
                ctx.moveTo(sz.x, 0);
                ctx.lineTo(sz.x, sz.y);
                ctx.moveTo(0, sz.y);
                ctx.lineTo(sz.x, sz.y);
            }
            ctx.stroke();
        } else if (coords.z === 16) { // merge eight into one
            const lon = tile2long(coords.x, coords.z);
            const lat = tile2lat(coords.y, coords.z);
            const z14x = lon2tile(lon, 14);
            const z14y = lat2tile(lat, 14);
            if (z14y*4 === coords.y) { // top row
                if (z14x*4 === coords.x) {// top left
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(0, sz.x);
                    ctx.moveTo(0, 0);
                    ctx.lineTo(sz.y, 0);
                    ctx.stroke();
                }
                if (z14x*4+3 === coords.x) {// top right
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(sz.x, 0);
                    ctx.moveTo(sz.x, 0);
                    ctx.lineTo(sz.x, sz.y);
                    ctx.stroke();
                }
                else {
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(sz.x, 0);
                    ctx.stroke();
                }
            }
            if (z14y*4+3 === coords.y) { // bottom row
                if (z14x*4 === coords.x) { // bottom left
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(0, sz.y);
                    ctx.moveTo(0, sz.y);
                    ctx.lineTo(sz.x, sz.y);
                    ctx.stroke();
                }
                if (z14x*4+3 === coords.x) {// bottom right
                    ctx.beginPath();
                    ctx.moveTo(0, sz.x);
                    ctx.lineTo(sz.x, sz.y);
                    ctx.moveTo(sz.y, 0);
                    ctx.lineTo(sz.x, sz.y);
                    ctx.stroke();
                }
                else {
                    ctx.beginPath();
                    ctx.moveTo(0, sz.y);
                    ctx.lineTo(sz.x, sz.y);
                    ctx.stroke();
                }
            }
            if (z14x*4 === coords.x) { // left
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(0, sz.y);
                ctx.stroke();
            }
            if (z14x*4+3 === coords.x) { // right
                ctx.beginPath();
                ctx.moveTo(sz.x, 0);
                ctx.lineTo(sz.x, sz.y);
                ctx.stroke();
            }
        }
        // return the tile so it can be rendered on screen
        return tile;
      },
  });
  L.gridLayer.gridDebug = (opts) => new L.GridLayer.GridDebug(opts);

  const routeGroup = L.layerGroup(routing);
  const tileGroup = L.layerGroup(tiling);
  const blockGroup = L.layerGroup([maxSquare]);
  const clusterGroup = L.layerGroup(clustering);
  const allTilesGroup = L.layerGroup([L.gridLayer.gridDebug({
    minZoom: 13, maxZoom: 16
  })]);

  const overlays = {};
  overlays[`Rides (${routing.length})`] = routeGroup;
  overlays[`Tiles (${tiling.length})`] = tileGroup;
  overlays[`Cluster (${clustering.length})`] = clusterGroup;
  overlays[`Max Square (${square.l}*${square.l})`] = blockGroup;
  overlays['All Tiles'] = allTilesGroup;

  const osmLayer = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
      },
  );
  const map = L.map('map', {layers: [osmLayer, routeGroup, tileGroup]});
  L.control.layers(null, overlays).addTo(map);
  L.control.scale({imperial: false}).addTo(map);
  L.control.locate({
    locateOptions: {maxZoom: 14, enableHighAccuracy: true},
  }).addTo(map);

  const syncCtrl = L.easyButton('fa-refresh', () => window.location.href='/sync');
  syncCtrl.button.setAttribute('aria-label', 'sync');
  syncCtrl.addTo(map);
  map.locate({setView: true, maxZoom: 12});
}

