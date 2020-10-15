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
      ride.route, {
          color: 'blue',
          weight: 1,
          opacity: 0.7,
          lineJoin: 'round',
      },
  ).on({
      popupopen: (e) => e.target.setStyle({
          color: 'red',
          weight: 5,
          opacity: 0.7
      }),
      popupclose: (e) => e.target.setStyle({
          color: 'blue',
          weight: 1,
          opacity: 0.7
      }),
  }).bindPopup(
      `<strong>${ride.title}</strong><br />
         ${ride.date.slice(0, -1)}<br />
         ${(ride.dist / 1000.0).toFixed(2)} km<br />
         avg: ${((ride.avg / 1000.0) * 60 * 60).toFixed(2)} km/h<br />
         max: ${((ride.max / 1000.0) * 60 * 60).toFixed(2)} km/h<br />
         elevation: ${parseInt(ride.elev, 10)} m<br />
         ride time: ${toDuration(ride.net)}<br />
      total time: ${toDuration(ride.gross)}<br />
        `, {
          closeOnClick: false
      },
  ));

  const tiling = tiles.map((t) => L.polygon(t.coordinates, {
      color: '#006400',
      opacity: 0.5,
      weight: 0.5,
      fillOpacity: 0.1,
      interactive: false,
  }));

  const maxSquare = L.polygon(
      square.shape, {
          color: 'blue',
          opacity: 0.5,
          weight: 0.5,
          fillOpacity: 0.1,
          interactive: false,
      },
  );

  const clustering = cluster.map((c) => L.polygon(c.coordinates, {
      color: 'red',
      opacity: 0.5,
      weight: 0.5,
      fillOpacity: 0.1,
      interactive: false,
  }));

  lon2tile = (lon, zoom) => Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
  lat2tile = (lat, zoom) => Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
  tile2lon = (x, z) => x / Math.pow(2, z) * 360 - 180;
  tile2lat = (y, z) => {
      var n = Math.PI - 2 * Math.PI * y / Math.pow(2, z);
      return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  }

  drawTop = (c, ctx) => {
      ctx.moveTo(0, 0);
      ctx.lineTo(c.x, 0);
      ctx.stroke();
  }

  drawBottom = (c, ctx) => {
      ctx.moveTo(0, c.y);
      ctx.lineTo(c.x, c.y);
      ctx.stroke();
  }

  drawLeft = (c, ctx) => {
      ctx.moveTo(0, 0);
      ctx.lineTo(0, c.y);
      ctx.stroke();
  }

  drawRight = (c, ctx) => {
      ctx.moveTo(c.x, 0);
      ctx.lineTo(c.x, c.y);
      ctx.stroke();
  }

  drawTopLeft = (c, ctx) => {
      drawTop(c, ctx);
      drawLeft(c, ctx);
  }

  drawTopRight = (c, ctx) => {
      drawTop(c, ctx);
      drawRight(c, ctx);
  }

  drawBottomLeft = (c, ctx) => {
      drawBottom(c, ctx);
      drawLeft(c, ctx);
  }

  drawBottomRight = (c, ctx) => {
      drawBottom(c, ctx);
      drawRight(c, ctx);
  }

  merge = (c, bounds, ctx, w) => {
      const lon = tile2lon(c.x, c.z);
      const lat = tile2lat(c.y, c.z);
      const z14x = lon2tile(lon, 14);
      const z14y = lat2tile(lat, 14);

      ctx.beginPath();
      if (z14y * w === c.y) { // top row
          if (z14x * w === c.x) {
              drawTopLeft(bounds, ctx);
          }
          if (z14x * w + w - 1 === c.x) {
              drawTopRight(bounds, ctx);
          } else {
              drawTop(bounds, ctx);
          }
      }
      if (z14y * w + w - 1 === c.y) { // bottom row
          if (z14x * w === c.x) { // bottom left
              drawBottomLeft(bounds, ctx);
          }
          if (z14x * w + w - 1 === c.x) { // bottom right
              drawBottomRight(bounds, ctx);
          } else {
              drawBottom(bounds, ctx);
          }
      }
      if (z14x * w === c.x) { // left
          drawLeft(bounds, ctx);
      }
      if (z14x * w + w - 1 === c.x) { // right
          drawRight(bounds, ctx);
      }
  }

  L.GridLayer.GridDebug = L.GridLayer.extend({
      createTile: function(coords) {
          const bounds = this.getTileSize();
          const tile = L.DomUtil.create('canvas', 'leaflet-tile');
          tile.width = bounds.x;
          tile.height = bounds.y;
          var ctx = tile.getContext('2d');
          if (coords.z === 13) { // split in four
              ctx.rect(0, 0, bounds.x / 2, bounds.y / 2);
              ctx.rect(0, bounds.y / 2, bounds.x / 2, bounds.y / 2);
              ctx.rect(bounds.x / 2, 0, bounds.x / 2, bounds.y / 2);
              ctx.rect(bounds.x / 2, bounds.y / 2, bounds.x / 2, bounds.y / 2);
              ctx.stroke();
          } else {
              merge(coords, bounds, ctx, Math.pow(2, coords.z - 14));
          }
          return tile;
      },
  });

  L.gridLayer.gridDebug = (opts) => new L.GridLayer.GridDebug(opts);

  const routeGroup = L.layerGroup(routing);
  const tileGroup = L.layerGroup(tiling);
  const blockGroup = L.layerGroup([maxSquare]);
  const clusterGroup = L.layerGroup(clustering);
  const allTilesGroup = L.layerGroup([L.gridLayer.gridDebug({
      minZoom: 13,
      maxZoom: 18
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
  const map = L.map('map', {
      layers: [osmLayer, routeGroup, tileGroup]
  });
  L.control.layers(null, overlays).addTo(map);
  L.control.scale({
      imperial: false
  }).addTo(map);
  L.control.locate({
      locateOptions: {
          maxZoom: 14,
          enableHighAccuracy: true
      },
  }).addTo(map);

  const syncCtrl = L.easyButton('fa-refresh', () => window.location.href = '/sync');
  syncCtrl.button.setAttribute('aria-label', 'sync');
  syncCtrl.addTo(map);
  map.locate({
      setView: true,
      maxZoom: 12
  });
}