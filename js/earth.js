// Created by Bjorn Sandvik - thematicmapping.org
(function () {
  const webglEl = document.getElementById("webgl");

  if (!Detector.webgl) {
    Detector.addGetWebGLMessage(webglEl);
    return;
  }

  const width = window.innerWidth;
  const height = window.innerHeight;

  let radiusValue = 0;
  if (width == 1366) {
    radiusValue = 1.6;
  } else {
    radiusValue = 1.6;
  }

  // Earth params
  const radius = radiusValue;
  const segments = 32;
  const rotation = 60;

  let flight_path_splines = [];
  let flight_path_lines;
  const flight_point_start_time = [];
  const flight_point_end_time = [];
  const flight_distance = [];
  const start_flight_idx = 0;
  const end_flight_idx = flights.length;
  const flight_point_speed_scaling = 5.0;
  const flight_point_speed_min_scaling = 1.0;
  const flight_point_speed_max_scaling = 25.0;
  const flight_track_opacity = 1;
  const pointPosition = [];

  const objects = [];
  const scene = new THREE.Scene();

  /**
   * WEBGL Redenerer
   * The WebGL renderer displays your beautifully crafted scenes using WebGL.
   */
  const renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setSize(width, height);

  /**
   * Camera Position
   */
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 10000);
  camera.position.set(5, 2, -5.5);

  /**
   * Directional Light
   * https://threejs.org/docs/#api/en/lights/DirectionalLight
   */
  const light = new THREE.DirectionalLight(0xffffff, 0.2);
  light.position.set(5, 2, -3.5);
  scene.add(light);

  /**
   * Ambient Light
   * This light globally illuminates all objects in the scene equally.
   */
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  const sphere = createSphere(radius, segments);
  scene.add(sphere);

  var stars = createStars(90, 64);
  scene.add(stars);

  /**
   * OrbitControls
   * Orbit controls allow the camera to orbit around a target.
   * To use this, as with all files in the /examples directory, you will have to include the file seperately in your HTML.
   */
  const controls = new THREE.OrbitControls(camera, renderer.domElement); //new THREE.TrackballControls(camera);
  controls.enableZoom = false;

  //===============================================================================================

  generateControlPoints(radius);

  flight_path_lines = flightPathLines();
  scene.add(flight_path_lines);

  const missionPoints = flightPointCloud(radius);
  scene.add(missionPoints);

  /**
   * Raycaster
   * This class is designed to assist with raycasting.
   * Raycasting is used for mouse picking (working out what objects in the 3d space the mouse is over) amongst other things.
   */
  const raycaster = new THREE.Raycaster();

  /**
   * Vector2
   * Class representing a 2D vector.
   * A 2D vector is an ordered pair of numbers (labeled x and y), which can be used to represent a number of things.
   * https://threejs.org/docs/#api/en/math/Vector2
   */
  const mouse = new THREE.Vector2();

  // when the mouse moves, call the given function
  document.addEventListener("mousedown", onDocumentMouseDown, false);
  //===============================================================================================

  scene.traverse(function (children) {
    objects.push(children);
  });

  webglEl.appendChild(renderer.domElement);

  render();

  window.addEventListener("resize", onWindowResize, false);

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function onDocumentMouseDown(e) {
    e.preventDefault();

    mouse.x = (e.clientX / renderer.domElement.width) * 2 - 1;
    mouse.y = -(e.clientY / renderer.domElement.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
  }

  function map(x, in_min, in_max, out_min, out_max) {
    return ((x - in_min) * (out_max - out_min)) / (in_max - in_min) + out_min;
  }

  function render() {
    controls.update();
    sphere.rotation.y += 0.0025;
    flight_path_lines.rotation.y += 0.0025;
    missionPoints.rotation.y += 0.0025;
    requestAnimationFrame(render);
    renderer.render(scene, camera);
  }

  function createSphere(radius, segments) {
    /**
     *  Mesh
     * Class representing triangular polygon mesh based objects.
     * Also serves as a base for other classes such as SkinnedMesh.
     * https://threejs.org/docs/#api/en/objects/Mesh
     */
    return new THREE.Mesh(
      new THREE.SphereGeometry(radius, 20, 20),
      new THREE.MeshPhongMaterial({
        map: new THREE.TextureLoader().load("./images/black_white_4k.jpg"),
        bumpMap: THREE.ImageUtils.loadTexture("./images/elev_bump_4k.jpg"),
        bumpScale: 0.35,
        specularMap: new THREE.TextureLoader().load("./images/water_4k.png"),
        specular: new THREE.Color("grey"),
      })
    );
  }

  function createClouds(radius, segments) {
    return new THREE.Mesh(
      new THREE.SphereGeometry(radius + 0.003, segments, segments),
      new THREE.MeshPhongMaterial({
        map: new THREE.TextureLoader().load("./images/fair_clouds_4k.png"),
        transparent: true,
      })
    );
  }

  function createStars(radius, segments) {
    return new THREE.Mesh(
      new THREE.SphereGeometry(radius, segments, segments),
      new THREE.MeshBasicMaterial({
        map: new THREE.TextureLoader().load("./images/galaxy_starfield.png"),
        side: THREE.BackSide,
      })
    );
  }

  function generateControlPoints(radius) {
    for (let f = start_flight_idx; f < end_flight_idx; ++f) {
      const start_lat = flights[f][0];
      const start_lng = flights[f][1];
      const end_lat = flights[f][2];
      const end_lng = flights[f][3];
      const max_height = 0.1;

      const points = [];
      const spline_control_points = 8;
      for (let i = 0; i < spline_control_points + 1; i++) {
        const arc_angle = (i * 180.0) / spline_control_points;
        const arc_radius = radius + Math.sin((arc_angle * Math.PI) / 180.0) * max_height;
        const latlng = latlngInterPoint(start_lat, start_lng, end_lat, end_lng, i / spline_control_points);

        const pos = xyzFromLatLng(latlng.lat, latlng.lng, arc_radius);

        points.push(new THREE.Vector3(pos.x, pos.y, pos.z));
      }

      const spline = new THREE.CatmullRomCurve3(points);
      const arc_length = spline.getLength();

      flight_path_splines.push(spline);
      flight_distance.push(arc_length);

      setFlightTimes(f);
    }
  }

  function xyzFromLatLng(lat, lng, radius) {
    const phi = ((90 - lat) * Math.PI) / 180;
    const theta = ((360 - lng) * Math.PI) / 180;

    return {
      x: radius * Math.sin(phi) * Math.cos(theta),
      y: radius * Math.cos(phi),
      z: radius * Math.sin(phi) * Math.sin(theta),
    };
  }

  function latlngInterPoint(lat1, lng1, lat2, lng2, offset) {
    lat1 = (lat1 * Math.PI) / 180.0;
    lng1 = (lng1 * Math.PI) / 180.0;
    lat2 = (lat2 * Math.PI) / 180.0;
    lng2 = (lng2 * Math.PI) / 180.0;

    d =
      2 * Math.asin(Math.sqrt(Math.pow(Math.sin((lat1 - lat2) / 2), 2) + Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin((lng1 - lng2) / 2), 2)));
    A = Math.sin((1 - offset) * d) / Math.sin(d);
    B = Math.sin(offset * d) / Math.sin(d);
    x = A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2);
    y = A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2);
    z = A * Math.sin(lat1) + B * Math.sin(lat2);
    lat = (Math.atan2(z, Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2))) * 180) / Math.PI;
    lng = (Math.atan2(y, x) * 180) / Math.PI;

    return {
      lat: lat,
      lng: lng,
    };
  }

  function flightPathLines() {
    const num_control_points = 32;

    const geometry = new THREE.BufferGeometry();
    const material = new THREE.LineBasicMaterial({
      color: 0x00d8cc,
      vertexColors: THREE.VertexColors,
      transparent: true,
      opacity: flight_track_opacity,
      depthTest: true,
      depthWrite: false,
      linewidth: 2,
    });

    const line_positions = new Float32Array(flights.length * 3 * 2 * num_control_points);
    const colors = new Float32Array(flights.length * 3 * 2 * num_control_points);

    for (let i = start_flight_idx; i < end_flight_idx; ++i) {
      for (let j = 0; j < num_control_points - 1; ++j) {
        const start_pos = flight_path_splines[i].getPoint(j / (num_control_points - 1));
        const end_pos = flight_path_splines[i].getPoint((j + 1) / (num_control_points - 1));

        line_positions[(i * num_control_points + j) * 6 + 0] = start_pos.x;
        line_positions[(i * num_control_points + j) * 6 + 1] = start_pos.y;
        line_positions[(i * num_control_points + j) * 6 + 2] = start_pos.z;
        line_positions[(i * num_control_points + j) * 6 + 3] = end_pos.x;
        line_positions[(i * num_control_points + j) * 6 + 4] = end_pos.y;
        line_positions[(i * num_control_points + j) * 6 + 5] = end_pos.z;

        colors[(i * num_control_points + j) * 6 + 0] = 177;
        colors[(i * num_control_points + j) * 6 + 1] = 177;
        colors[(i * num_control_points + j) * 6 + 2] = 177;
        colors[(i * num_control_points + j) * 6 + 3] = 177;
        colors[(i * num_control_points + j) * 6 + 4] = 0;
        colors[(i * num_control_points + j) * 6 + 5] = 0;
      }
    }

    //console.log(colors);
    geometry.addAttribute("position", new THREE.BufferAttribute(line_positions, 3));
    geometry.addAttribute("color", new THREE.BufferAttribute(colors, 3));

    geometry.computeBoundingSphere();

    return new THREE.Line(geometry, material, THREE.LineSegments);
  }

  function flightPointCloud(radius) {
    const points = [];
    const endpoints = [];

    for (let f = start_flight_idx; f < end_flight_idx; ++f) {
      const start_lat = flights[f][0];
      const start_lng = flights[f][1];
      const end_lat = flights[f][2];
      const end_lng = flights[f][3];

      const startpos = xyzFromLatLng(start_lat, start_lng, radius);
      const endpos = xyzFromLatLng(end_lat, end_lng, radius);

      points[f] = new THREE.Vector3(startpos.x, startpos.y, startpos.z);
      pointPosition[pointPosition.length] = new THREE.Vector3(startpos.x, startpos.y, startpos.z);
      endpoints[f] = new THREE.Vector3(endpos.x, endpos.y, endpos.z);
      pointPosition[pointPosition.length] = new THREE.Vector3(startpos.x, startpos.y, startpos.z);
    }

    const geometry = new THREE.Geometry();
    for (let i = 0; i < end_flight_idx; i++) {
      geometry.vertices.push(points[i]);
      geometry.vertices.push(endpoints[i]);
    }

    const sprite = new THREE.TextureLoader().load("./images/disc.png");
    const material = new THREE.PointsMaterial({ size: 20, sizeAttenuation: false, map: sprite, alphaTest: 0.5, transparent: true, color: 0x00fff0 });

    return (pointCloud = new THREE.Points(geometry, material));
  }

  function setFlightTimes(index) {
    const scaling_factor =
      (flight_point_speed_scaling - flight_point_speed_min_scaling) / (flight_point_speed_max_scaling - flight_point_speed_min_scaling);
    const duration = (1 - scaling_factor) * flight_distance[index] * 80000;

    const start_time = Date.now() + Math.random() * 5000;
    flight_point_start_time[index] = start_time;
    flight_point_end_time[index] = start_time + duration;
  }
})();
