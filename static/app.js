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

  L.GridLayer.GridDebug = L.GridLayer.extend({
    createTile: (coords) => {
      const tile = L.DomUtil.create('div', 'leaflet-tile');
      tile.style.outline = '1px solid grey';
      tile.style.fontWeight = 'bold';
      tile.style.fontSize = '14pt';
      tile.innerHTML = `&nbsp;${coords.x}/${coords.y}`;
      return tile;
    },
  });
  L.gridLayer.gridDebug = (opts) => new L.GridLayer.GridDebug(opts);

  const routeGroup = L.layerGroup(routing);
  const tileGroup = L.layerGroup(tiling);
  const blockGroup = L.layerGroup([maxSquare]);
  const clusterGroup = L.layerGroup(clustering);
  const allTilesGroup = L.layerGroup([L.gridLayer.gridDebug({
    minZoom: 13, maxZoom: 14,
  })]);

  const overlays = {};
  overlays[`Rides (${routing.length})`] = routeGroup;
  overlays[`Tiles (${tiling.length})`] = tileGroup;
  overlays[`Cluster (${clustering.length})`] = clusterGroup;
  overlays[`Max Square (${square.l*square.l} km<sup>2</sup>)`] = blockGroup;
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
  map.locate({setView: true, maxZoom: 12});
}

