import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import {Circle as CircleStyle, Fill,Icon , Stroke, Style} from 'ol/style';
import {Draw, Modify, Snap} from 'ol/interaction';
import {Circle, GeometryCollection, Point, Polygon} from 'ol/geom';
import {OSM, Vector as VectorSource} from 'ol/source';
import {Tile as TileLayer, Vector as VectorLayer} from 'ol/layer';
import {circular} from 'ol/geom/Polygon';
import {getDistance} from 'ol/sphere';
import {transform, useGeographic} from 'ol/proj';
import {Feature, Overlay} from 'ol/index';
import Polyline from 'ol/format/Polyline';
import XYZ from 'ol/source/XYZ';
import {getVectorContext} from 'ol/render';
// useGeographic();


const place = [-110, 45];

const point = new Point(place);

const raster = new TileLayer({
  source: new OSM()
});

const source = new VectorSource({
  features: [new Feature(point)]
});

const style = new Style({
  fill: new Fill({
    color: 'rgba(255, 255, 255, 0.2)',
  }),
  stroke: new Stroke({
    color: 'red',
    width: 2,
  }),
  image: new CircleStyle({
    radius: 7,
    width:50,
    fill: new Fill({
      color: 'red',
    }),
  }),
});

const geodesicStyle = new Style({
  geometry: function (feature) {
    return feature.get('modifyGeometry') || feature.getGeometry();
  },
  fill: new Fill({
    color: 'rgba(255, 255, 255, 0.2)',
  }),
  stroke: new Stroke({
    color: '#ff3333',
    width: 2,
  }),
  image: new CircleStyle({
    radius: 7,
    fill: new Fill({
      color: 'rgba(0, 0, 0, 0)',
    }),
  }),
});

const vector = new VectorLayer({
  source: source,
  style:
  function (feature) {
    const geometry = feature.getGeometry();
    return geometry.getType() === 'GeometryCollection' ? geodesicStyle : style;
  }
});

const map = new Map({
  layers: [
    raster,
    vector,
  ],
  target: document.getElementById('map'),
  view: new View({
    center: place,
    zoom: 3
  }),
});

const element = document.getElementById('popup');

const popup = new Overlay({
  element: element,
  positioning: 'bottom-center',
  stopEvent: false,
  offset: [0, -10],
});
map.addOverlay(popup);

function formatCoordinate(coordinate) {
  return `
    <table>
      <tbody>
        <tr><th>lon</th><td>${coordinate[0].toFixed(2)}</td></tr>
        <tr><th>lat</th><td>${coordinate[1].toFixed(2)}</td></tr>
      </tbody>
    </table>`;
}

const info = document.getElementById('info');
map.on('moveend', function () {
  const view = map.getView();
  const center = view.getCenter();
  info.innerHTML = formatCoordinate(center);
});

map.on('click', function (event) {
  $(element).popover('dispose');

  const feature = map.getFeaturesAtPixel(event.pixel)[0];
  if (feature) {
    const coordinate = feature.getGeometry().getCoordinates();
    popup.setPosition([
      coordinate[0] + Math.round(event.coordinate[0] / 360) * 360,
      coordinate[1],
    ]);
    $(element).popover({
      container: element.parentElement,
      html: true,
      sanitize: false,
      content: formatCoordinate(coordinate),
      placement: 'top',
    });
    $(element).popover('show');
  }
});

map.on('pointermove', function (event) {
  if (map.hasFeatureAtPixel(event.pixel)) {
    map.getViewport().style.cursor = 'pointer';
  } else {
    map.getViewport().style.cursor = 'inherit';
  }
});

const defaultStyle = new Modify({source: source})
  .getOverlay()
  .getStyleFunction();

const modify = new Modify({
  source: source,
  style: function (feature) {
    feature.get('features').forEach(function (modifyFeature) {
      const modifyGeometry = modifyFeature.get('modifyGeometry');
      if (modifyGeometry) {
        const modifyPoint = feature.getGeometry().getCoordinates();
        const geometries = modifyFeature.getGeometry().getGeometries();
        const polygon = geometries[0].getCoordinates()[0];
        const center = geometries[1].getCoordinates();
        const projection = map.getView().getProjection();
        let first, last, radius;
        if (modifyPoint[0] === center[0] && modifyPoint[1] === center[1]) {
          // center is being modified
          // get unchanged radius from diameter between polygon vertices
          first = transform(polygon[0], projection, 'EPSG:4326');
          last = transform(
            polygon[(polygon.length - 1) / 2],
            projection,
            'EPSG:4326'
          );
          radius = getDistance(first, last) / 2;
        } else {
          // radius is being modified
          first = transform(center, projection, 'EPSG:4326');
          last = transform(modifyPoint, projection, 'EPSG:4326');
          radius = getDistance(first, last);
        }
        // update the polygon using new center or radius
        const circle = circular(
          transform(center, projection, 'EPSG:4326'),
          radius,
          128
        );
        circle.transform('EPSG:4326', projection);
        geometries[0].setCoordinates(circle.getCoordinates());
        // save changes to be applied at the end of the interaction
        modifyGeometry.setGeometries(geometries);
      }
    });
    return defaultStyle(feature);
  },
});

modify.on('modifystart', function (event) {
  event.features.forEach(function (feature) {
    const geometry = feature.getGeometry();
    if (geometry.getType() === 'GeometryCollection') {
      feature.set('modifyGeometry', geometry.clone(), true);
    }
  });
});

modify.on('modifyend', function (event) {
  event.features.forEach(function (feature) {
    const modifyGeometry = feature.get('modifyGeometry');
    if (modifyGeometry) {
      feature.setGeometry(modifyGeometry);
      feature.unset('modifyGeometry', true);
    }
  });
});

map.addInteraction(modify);

let draw, snap; // global so we can remove them later
const typeSelect = document.getElementById('type');

function addInteractions() {
  let value = typeSelect.value;
  let geometryFunction;
  if (value === 'Geodesic') {
    value = 'Circle';
    geometryFunction = function (coordinates, geometry, projection) {
      if (!geometry) {
        geometry = new GeometryCollection([
          new Polygon([]),
          new Point(coordinates[0]),
        ]);
      }
      const geometries = geometry.getGeometries();
      const center = transform(coordinates[0], projection, 'EPSG:4326');
      const last = transform(coordinates[1], projection, 'EPSG:4326');
      const radius = getDistance(center, last);
      const circle = circular(center, radius, 128);
      circle.transform('EPSG:4326', projection);
      geometries[0].setCoordinates(circle.getCoordinates());
      geometry.setGeometries(geometries);
      return geometry;
    };
  }
  draw = new Draw({
    source: source,
    type: value,
    freehand : true,
    geometryFunction: geometryFunction,
  });
  map.addInteraction(draw);
  snap = new Snap({source: source});
  map.addInteraction(snap);
}

// Partie Marker Animation
fetch('data/polyline/route.json').then(function (response) {
  response.json().then(function (result) {
    const polyline = result.routes[0].geometry;

    const route = new Polyline({
      factor: 1e6,
    }).readGeometry(polyline, {
      dataProjection: 'EPSG:4326',
      featureProjection: 'EPSG:3857',
    });

    const routeFeature = new Feature({
      type: 'route',
      geometry: route,
    });

    const startMarker = new Feature({
      type: 'icon',
      geometry: new Point(route.getFirstCoordinate()),
    });

    const endMarker = new Feature({
      type: 'icon',
      geometry: new Point(route.getLastCoordinate()),
    });

    const position = startMarker.getGeometry().clone();
    const geoMarker = new Feature({
      type: 'geoMarker',
      geometry: position,
    });

    const styles = {
      'route': new Style({
        stroke: new Stroke({
          width: 6,
          color: [237, 212, 0, 0.8],
        }),
      }),
      'icon': new Style({
        image: new Icon({
          anchor: [0.5, 1],
          src: 'data/icon.png',
        }),
      }),
      'geoMarker': new Style({
        image: new CircleStyle({
          radius: 7,
          fill: new Fill({color: 'black'}),
          stroke: new Stroke({
            color: 'white',
            width: 2,
          }),
        }),
      }),
    };

    const vectorLayer = new VectorLayer({
      source: new VectorSource({
        features: [routeFeature, geoMarker, startMarker, endMarker],
      }),
      style: function (feature) {
        return styles[feature.get('type')];
      },
    });

    map.addLayer(vectorLayer);

    const speedInput = document.getElementById('speed');
    const startButton = document.getElementById('start-animation');
    let animating = false;
    let distance = 0;
    let lastTime;

    function moveFeature(event) {
      const speed = Number(speedInput.value);
      const time = event.frameState.time;
      const elapsedTime = time - lastTime;
      distance = (distance + (speed * elapsedTime) / 1e6) % 2;
      lastTime = time;

      const currentCoordinate = route.getCoordinateAt(
        distance > 1 ? 2 - distance : distance
      );
      position.setCoordinates(currentCoordinate);
      const vectorContext = getVectorContext(event);
      vectorContext.setStyle(styles.geoMarker);
      vectorContext.drawGeometry(position);
      // tell OpenLayers to continue the postrender animation
      map.render();
    }

    function startAnimation() {
      animating = true;
      lastTime = Date.now();
      startButton.textContent = 'Stop Animation';
      vectorLayer.on('postrender', moveFeature);
      // hide geoMarker and trigger map render through change event
      geoMarker.setGeometry(null);
    }

    function stopAnimation() {
      animating = false;
      startButton.textContent = 'Start Animation';

      // Keep marker at current animation position
      geoMarker.setGeometry(position);
      vectorLayer.un('postrender', moveFeature);
    }

    startButton.addEventListener('click', function () {
      if (animating) {
        stopAnimation();
      } else {
        startAnimation();
      }
    });
  
  });
});
/**
 * Handle change event.
 */
typeSelect.onchange = function () {
  map.removeInteraction(draw);
  map.removeInteraction(snap);
  addInteractions();
};

addInteractions();
