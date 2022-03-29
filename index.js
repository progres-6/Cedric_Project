import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import {Circle as CircleStyle, Fill,Icon , Stroke, Style} from 'ol/style';
import {Draw, Modify, Snap} from 'ol/interaction';
import {Circle, GeometryCollection, Point, Polygon, LineString} from 'ol/geom';
import {OSM, Vector as VectorSource} from 'ol/source';
import {Tile as TileLayer, Vector as VectorLayer} from 'ol/layer';
import {circular} from 'ol/geom/Polygon';
import {getDistance} from 'ol/sphere';
import {transform} from 'ol/proj';
import {Feature, Overlay} from 'ol/index';
import {getArea, getLength} from 'ol/sphere';
import {unByKey} from 'ol/Observable';

// measure

/**
 * Currently drawn feature.
 * @type {import("../src/ol/Feature.js").default}
 */
 let sketch;

 /**
  * The help tooltip element.
  * @type {HTMLElement}
  */
 let helpTooltipElement;
 
 /**
  * Overlay to show the help messages.
  * @type {Overlay}
  */
 let helpTooltip;
 
 /**
  * The measure tooltip element.
  * @type {HTMLElement}
  */
 let measureTooltipElement;
 
/**
 * Message to show when the user is drawing a polygon.
 * @type {string}
 */
 const continuePolygonMsg = 'Click to continue drawing the polygon';

 /**
  * Message to show when the user is drawing a line.
  * @type {string}
  */
 const continueLineMsg = 'Click to continue drawing the line';


/**
 * Handle pointer move.
 * @param {import("../src/ol/MapBrowserEvent").default} evt The event.
 */
const pointerMoveHandler = function (evt) {
  if (evt.dragging) {
    return;
  }
  /** @type {string} */
  let helpMsg = 'Click to start drawing';

  if (sketch) {
    const geom = sketch.getGeometry();
    if (geom instanceof Polygon) {
      helpMsg = continuePolygonMsg;
    } else if (geom instanceof LineString) {
      helpMsg = continueLineMsg;
    }
  }

  helpTooltipElement.innerHTML = helpMsg;
  helpTooltip.setPosition(evt.coordinate);

  helpTooltipElement.classList.remove('hidden');
};

/**
* Overlay to show the measurement.
* @type {Overlay}
*/
let measureTooltip;
 
/**
 * Format length output.
 * @param {LineString} line The line.
 * @return {string} The formatted length.
 */
 const formatLength = function (line) {
  const length = getLength(line);
  let output;
  if (length > 100) {
    output = Math.round((length / 1000) * 100) / 100 + ' ' + 'km';
  } else {
    output = Math.round(length * 100) / 100 + ' ' + 'm';
  }
  return output;
};

/**
 * Format area output.
 * @param {Polygon} polygon The polygon.
 * @return {string} Formatted area.
 */
 const formatArea = function (polygon) {
  const area = getArea(polygon);
  let output;
  if (area > 10000) {
    output = Math.round((area / 1000000) * 100) / 100 + ' ' + 'km<sup>2</sup>';
  } else {
    output = Math.round(area * 100) / 100 + ' ' + 'm<sup>2</sup>';
  }
  return output;
};

function addInteraction() {
  const type = typeSelect.value == 'area' ? 'Polygon' : 'LineString';
  draw = new Draw({
    source: source,
    type: type,
    style: new Style({
      fill: new Fill({
        color: 'rgba(255, 255, 255, 0.2)',
      }),
      stroke: new Stroke({
        color: 'rgba(0, 0, 0, 0.5)',
        lineDash: [10, 10],
        width: 2,
      }),
      image: new CircleStyle({
        radius: 5,
        stroke: new Stroke({
          color: 'rgba(0, 0, 0, 0.7)',
        }),
        fill: new Fill({
          color: 'rgba(255, 255, 255, 0.2)',
        }),
      }),
    }),
  });
  map.addInteraction(draw);

  createMeasureTooltip();
  createHelpTooltip();

  let listener;
  draw.on('drawstart', function (evt) {
    // set sketch
    sketch = evt.feature;

    /** @type {import("../src/ol/coordinate.js").Coordinate|undefined} */
    let tooltipCoord = evt.coordinate;

    listener = sketch.getGeometry().on('change', function (evt) {
      const geom = evt.target;
      let output;
      if (geom instanceof Polygon) {
        output = formatArea(geom);
        tooltipCoord = geom.getInteriorPoint().getCoordinates();
      } else if (geom instanceof LineString) {
        output = formatLength(geom);
        tooltipCoord = geom.getLastCoordinate();
      }
      measureTooltipElement.innerHTML = output;
      measureTooltip.setPosition(tooltipCoord);
    });
  });

  draw.on('drawend', function () {
    measureTooltipElement.className = 'ol-tooltip ol-tooltip-static';
    measureTooltip.setOffset([0, -7]);
    // unset sketch
    sketch = null;
    // unset tooltip so that a new one can be created
    measureTooltipElement = null;
    createMeasureTooltip();
    unByKey(listener);
  });
}

/**
 * Creates a new help tooltip
 */
 function createHelpTooltip() {
  if (helpTooltipElement) {
    helpTooltipElement.parentNode.removeChild(helpTooltipElement);
  }
  helpTooltipElement = document.createElement('div');
  helpTooltipElement.className = 'ol-tooltip hidden';
  helpTooltip = new Overlay({
    element: helpTooltipElement,
    offset: [15, 0],
    positioning: 'center-left',
  });
  map.addOverlay(helpTooltip);
}

/**
 * Creates a new measure tooltip
 */
 function createMeasureTooltip() {
  if (measureTooltipElement) {
    measureTooltipElement.parentNode.removeChild(measureTooltipElement);
  }
  measureTooltipElement = document.createElement('div');
  measureTooltipElement.className = 'ol-tooltip ol-tooltip-measure';
  measureTooltip = new Overlay({
    element: measureTooltipElement,
    offset: [0, -15],
    positioning: 'bottom-center',
    stopEvent: false,
    insertFirst: false,
  });
  map.addOverlay(measureTooltip);
}


// End measure


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
  } else{
    map.getViewport().style.cursor = 'inherit';
  }
});
map.on('pointermove', pointerMoveHandler);

map.getViewport().addEventListener('mouseout', function () {
  helpTooltipElement.classList.add('hidden');
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

const typeSelect = document.getElementById('type');

let draw, snap; // global so we can remove them later



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
/**
 * Handle change event.
 */
typeSelect.onchange = function () {
  map.removeInteraction(draw);
  map.removeInteraction(snap);
  addInteraction();
  addInteractions();
};


addInteraction();
addInteractions();
