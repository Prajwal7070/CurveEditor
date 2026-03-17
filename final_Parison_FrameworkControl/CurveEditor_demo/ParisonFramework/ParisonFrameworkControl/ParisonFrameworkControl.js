/// <reference path="./../../Packages/Beckhoff.TwinCAT.HMI.Framework.14.3.178/runtimes/native1.12-tchmi/TcHmi.d.ts" />
var TcHmi;
(function (TcHmi) {
    let Controls;
    (function (Controls) {
        let ParisonFramework;
        (function (ParisonFramework) {

            class ParisonFrameworkControl extends TcHmi.Controls.System
              .TcHmiControl {
              constructor(element, pcElement, attrs) {
                super(element, pcElement, attrs);

                // DOM root
                this.__elementTemplateRoot = null;

                // Three.js core
                this._scene = null;
                this._renderer = null;
                this._camera = null;
                this._controls = null;

                this._animationId = null;

                // Main container for all geometry
                this._pipeGroup = null;

                // Multi-layer container
                this._layerGroup = null;

                // Geometry reference profiles for external use
                this._dieOuterProfile = [];
                this._dieInnerProfile = [];

                // Active mode: DieMove | PinMove
                this._dieGeometry = "DieMove";

                // Raw FixedPoint profile
                this._fixedPoints = [];

                // Material sets
                this._spoolMaterial = null;
                this._basicMaterial = null;
                this._variableMaterial = null;
                this._innerMaterial = null;

                // Slicer state
                this._slicerEnabled = false;
                this._slicerPlane = null;

                // Attributes
                this._visualBasicThickness = 3.0;
                this._minVisualBasicThickness = 1.0;
                this._spoolCoreInner = 5.0;
                this._spoolCoreThickness = 2.0;

                this._layerPercentages = [100];
                this._minLayerThickness = 0.01;

                // Theme
                this.__themeChangedDestroy = null;

                this.__onResize = this.__onResize.bind(this);
              }

              // ---------------------------------------------------------------------
              // Lifecycle
              // ---------------------------------------------------------------------

              __previnit() {
                this.__elementTemplateRoot = this.__element.find(
                  ".TcHmi_Controls_ParisonFramework_ParisonFrameworkControl-Template"
                );
                if (this.__elementTemplateRoot.length === 0) {
                  throw new Error("Invalid Template.html (root not found)");
                }
                super.__previnit();
              }

              __init() {
                super.__init();
              }

              __attach() {
                super.__attach();

                if (typeof THREE === "undefined") {
                  console.error(
                    "Three.js not loaded – add to Description.json"
                  );
                  return;
                }
                if (typeof THREE.OrbitControls === "undefined") {
                  console.error(
                    "OrbitControls.js not loaded – add to Description.json"
                  );
                  return;
                }

                this._initThreeScene();
                this._applyThemeColors();

                // Theme reactivity
                this.__themeChangedDestroy = TcHmi.EventProvider.register(
                  "onThemeDataChanged",
                  () => {
                    this._applyThemeColors();
                    this._buildFromPoints(this._fixedPoints);
                  }
                );

                // Load initial fixed points
                let initial = this.getFixedPoints();
                if (
                  !initial ||
                  (Array.isArray(initial) && initial.length === 0)
                ) {
                  initial =
                    this.getAttribute && this.getAttribute("data-tchmi-points");
                }
                const normalized = this._coerceFixedPointList(initial);
                this._fixedPoints = normalized;

                // Build DieMove by default
                this._dieGeometry = "DieMove";
                this._buildFromPoints(normalized);

                // Rendering
                this._startRenderLoop();

                // Resize event
                this.__element.resize(this.__onResize);
              }

              __detach() {
                if (this.__themeChangedDestroy) {
                  this.__themeChangedDestroy();
                  this.__themeChangedDestroy = null;
                }

                super.__detach();
                if (this._animationId) {
                  cancelAnimationFrame(this._animationId);
                  this._animationId = null;
                }
              }

              destroy() {
                if (this.__keepAlive) return;

                try {
                  if (this._animationId) {
                    cancelAnimationFrame(this._animationId);
                    this._animationId = null;
                  }

                  this._disposeParisonMeshes();

                  if (this._renderer) {
                    this._renderer.dispose();
                    if (this._renderer.forceContextLoss)
                      this._renderer.forceContextLoss();
                    this._renderer.domElement = null;
                    this._renderer = null;
                  }

                  this._scene = null;
                  this._camera = null;
                  this._controls = null;
                  this._pipeGroup = null;

                  if (this.__element && this.__element.off) {
                    this.__element.off("resize", this.__onResize);
                  }
                } finally {
                  super.destroy();
                }
              }

              // ---------------------------------------------------------------------
              // Attribute – Public API
              // ---------------------------------------------------------------------

              setFixedPoints(value) {
                const list = this._coerceFixedPointList(value);
                this._fixedPoints = list;
                this._buildFromPoints(list);
              }
              getFixedPoints() {
                return this._fixedPoints;
              }

              setDieGeometry(val) {
                if (!val) return;
                this._dieGeometry = val;
                this._buildFromPoints(this._fixedPoints);
              }
              getDieGeometry() {
                return this._dieGeometry;
              }

              setVisualBasicThickness(value) {
                const v = this._toNumber(value);
                if (!isFinite(v)) return;
                this._visualBasicThickness = v;
                this._buildFromPoints(this._fixedPoints);
              }
              getVisualBasicThickness() {
                return this._visualBasicThickness;
              }

              setMinVisualBasicThickness(value) {
                const v = this._toNumber(value);
                if (!isFinite(v)) return;
                this._minVisualBasicThickness = v;
                this._buildFromPoints(this._fixedPoints);
              }
              getMinVisualBasicThickness() {
                return this._minVisualBasicThickness;
              }

              setSpoolCoreThickness(value) {
                const v = this._toNumber(value);
                if (!isFinite(v)) return;
                this._spoolCoreThickness = Math.max(0, v);
                this._buildFromPoints(this._fixedPoints);
              }
              getSpoolCoreThickness() {
                return this._spoolCoreThickness;
              }

              setSpoolCoreInner(value) {
                const v = this._toNumber(value);
                if (!isFinite(v)) return;
                this._spoolCoreInner = Math.max(0, v);
                this._buildFromPoints(this._fixedPoints);
              }
              getSpoolCoreInner() {
                return this._spoolCoreInner;
              }

              // Slicer API
              setSlicerEnabled(value) {
                const v =
                  value === true ||
                  value === "true" ||
                  value === 1 ||
                  value === "1";
                this._slicerEnabled = !!v;
                this._updateSlicer();
              }
              getSlicerEnabled() {
                return this._slicerEnabled;
              }

              setSlicer(value) {
                this.setSlicerEnabled(value);
              }
              getSlicer() {
                return this.getSlicerEnabled();
              }

              // Multi-layer percentages
              setLayerPercentages(value) {
                let arr = [];

                try {
                  if (Array.isArray(value)) {
                    arr = value.slice();
                  } else if (typeof value === "string") {
                    const s = value.trim();

                    if (s.startsWith("[") && s.endsWith("]")) {
                      try {
                        arr = JSON.parse(s);
                      } catch (e) {}
                    }

                    if ((!arr || arr.length === 0) && s.length > 0) {
                      if (s.indexOf(",") >= 0) {
                        arr = s.split(",").map((x) => x.trim());
                      } else {
                        arr = [s];
                      }
                    }
                  } else if (typeof value === "number") {
                    arr = [value];
                  }
                } catch (e) {
                  arr = [100];
                }

                arr = arr.map((v) => {
                  const n = Number(v);
                  return isFinite(n) && n > 0 ? n : 0;
                });

                const sum0 = arr.reduce((a, b) => a + b, 0);
                if (!Array.isArray(arr) || arr.length === 0 || sum0 <= 0) {
                  arr = [100];
                }

                const norm = this._normalizePercentages(arr);
                this._layerPercentages = norm;

                this._buildFromPoints(this._fixedPoints);
              }
              getLayerPercentages() {
                return this._layerPercentages.slice();
              }

              setMinLayerThickness(value) {
                const v = this._toNumber(value);
                if (!isFinite(v)) return;
                this._minLayerThickness = Math.max(0, v);
                this._buildFromPoints(this._fixedPoints);
              }
              getMinLayerThickness() {
                return this._minLayerThickness;
              }

              // ---------------------------------------------------------------------
              // Scene Initialisation
              // ---------------------------------------------------------------------

              _initThreeScene() {
                const width = this.__elementTemplateRoot.width();
                const height = this.__elementTemplateRoot.height();

                this._scene = new THREE.Scene();

                this._camera = new THREE.PerspectiveCamera(
                  60,
                  width / height,
                  0.1,
                  1000
                );
                this._camera.position.set(0, 150, 400);

                this._renderer = new THREE.WebGLRenderer({ antialias: true }); // for smooth edges
                this._renderer.setSize(width, height);
                this._renderer.setPixelRatio(window.devicePixelRatio || 1);
                this._renderer.localClippingEnabled = false;

                this.__elementTemplateRoot.append(this._renderer.domElement);

                this._controls = new THREE.OrbitControls(
                  this._camera,
                  this._renderer.domElement
                );
                this._controls.enableDamping = true;
                this._controls.dampingFactor = 0.05; // smooth inertial motion
                this._controls.enablePan = true;
                this._controls.minDistance = 100;
                this._controls.maxDistance = 800;

                // Lighting
                this._scene.add(new THREE.AmbientLight("white", 0.8));

                const dir = new THREE.DirectionalLight("white", 1);
                dir.position.set(200, 300, 300);
                this._scene.add(dir);

                const pt = new THREE.PointLight("white", 0.6);
                pt.position.set(-150, 100, -150);
                this._scene.add(pt);

                // Materials
                this._spoolMaterial = new THREE.MeshStandardMaterial({
                  color: "yellow",
                  metalness: 0.2,
                  roughness: 0.4,
                  side: THREE.DoubleSide,
                });

                this._basicMaterial = new THREE.MeshStandardMaterial({
                  color: "#ffffff",
                  transparent: true,
                  opacity: 0.1,
                  metalness: 0.1,
                  roughness: 0.5,
                  side: THREE.DoubleSide,
                });

                this._variableMaterial = new THREE.MeshStandardMaterial({
                  color: "#ffffff",
                  transparent: true,
                  opacity: 1.0,
                  metalness: 0.05,
                  roughness: 0.6,
                  side: THREE.DoubleSide,
                });

                this._innerMaterial = new THREE.MeshStandardMaterial({
                  color: "#ffffff",
                  metalness: 0.1,
                  roughness: 0.6,
                  side: THREE.DoubleSide,
                });

                // Group containing all geometry
                this._pipeGroup = new THREE.Group();
                this._pipeGroup.position.x = 50;
                this._scene.add(this._pipeGroup);

                // Slicer plane (normal along +X)
                this._slicerPlane = new THREE.Plane(
                  new THREE.Vector3(1, 0, 0),
                  -this._pipeGroup.position.x
                );
              }

              _startRenderLoop() {
                const loop = () => {
                  this._animationId = requestAnimationFrame(loop);
                  if (!this._renderer || !this._scene || !this._camera) return;
                  if (this._controls) this._controls.update();
                  this._renderer.render(this._scene, this._camera);
                };
                loop();
              }

              __onResize() {
                if (
                  !this._renderer ||
                  !this._camera ||
                  !this.__elementTemplateRoot
                )
                  return;

                const w = this.__elementTemplateRoot.width();
                const h = this.__elementTemplateRoot.height();

                this._camera.aspect = h === 0 ? 1 : w / h;
                this._camera.updateProjectionMatrix();
                this._renderer.setSize(w, h);

                if (this._slicerPlane && this._pipeGroup) {
                  this._slicerPlane.constant = -this._pipeGroup.position.x;
                  this._updateSlicer();
                }
              }

              // ---------------------------------------------------------------------
              // Helpers
              // ---------------------------------------------------------------------

              _toNumber(v) {
                if (typeof v === "number") return v;
                if (typeof v === "string" && v.trim() !== "") return Number(v);
                return NaN;
              }

              _coerceFixedPointList(input) {
                try {
                  let val = input;
                  if (typeof val === "string") val = JSON.parse(val);
                  if (!Array.isArray(val)) return [];

                  const out = [];
                  for (let i = 0; i < val.length; i++) {
                    const p = val[i] || {};
                    const base = this._toNumber(
                      p.Base !== undefined ? p.Base : p.base
                    );
                    const value = this._toNumber(
                      p.Value !== undefined ? p.Value : p.value
                    );
                    if (isFinite(base) && isFinite(value)) {
                      out.push({ Base: base, Value: value });
                    }
                  }
                  out.sort((a, b) => a.Base - b.Base);
                  return out;
                } catch (e) {
                  console.warn("Invalid FixedPointList format:", e);
                  return [];
                }
              }

              _normalizePercentages(arr) {
                if (!Array.isArray(arr) || arr.length === 0) return [100];

                let P = arr.map((x) => Math.max(0, Number(x) || 0));
                let sum = P.reduce((a, b) => a + b, 0);
                if (sum <= 0) return [100];

                const delta = 100 - sum;
                P[P.length - 1] = Math.max(0, P[P.length - 1] + delta);

                if (P.reduce((a, b) => a + b, 0) <= 0) return [100];
                return P;
              }

              // ---------------------------------------------------------------------
              // Geometry Disposal
              // ---------------------------------------------------------------------

              _disposeParisonMeshes() {
                if (this._pipeGroup) {
                  const toRemove = [];
                  this._pipeGroup.children.forEach((c) => toRemove.push(c));

                  toRemove.forEach((c) => {
                    this._pipeGroup.remove(c);
                    if (c.geometry) c.geometry.dispose();

                    if (c.children && c.children.length) {
                      const stack = [...c.children];
                      while (stack.length) {
                        const child = stack.pop();
                        if (child.geometry) child.geometry.dispose();
                        if (child.children && child.children.length) {
                          for (const cc of child.children) stack.push(cc);
                        }
                      }
                    }
                  });
                }

                this._layerGroup = null;

                this._spoolOuterMesh = null;
                this._spoolInnerMesh = null;
                this._basicOuterMesh = null;
                this._basicInnerMesh = null;

                this._topCapSpool = null;
                this._bottomCapSpool = null;
                this._topCapBasic = null;
                this._bottomCapBasic = null;
              }

              // ---------------------------------------------------------------------
              // Geometry Builder
              // ---------------------------------------------------------------------

              _buildFromPoints(points) {
                if (!this._scene || !this._pipeGroup) return;

                this._disposeParisonMeshes();
                if (!points || points.length < 2) return;

                const radialSegments = 512;

                const visualBasic = Number(this._visualBasicThickness) || 0;
                const minVisualBasic =
                  Number(this._minVisualBasicThickness) || 0;
                const effectiveBasic = Math.max(visualBasic, minVisualBasic);

                const spoolInner = Number(this._spoolCoreInner) || 0;
                const spoolThickness = Number(this._spoolCoreThickness) || 0;
                const spoolOuter = spoolInner + spoolThickness;

                const values = points.map((p) =>
                  isFinite(p.Value) && p.Value >= 0 ? p.Value : 0
                );

                const createShellMeshes = (
                  innerArr,
                  outerArr,
                  outerMaterial,
                  innerMaterialForInnerSurface
                ) => {
                  const outerProfile = [];
                  const innerProfile = [];

                  for (let i = 0; i < points.length; i++) {
                    outerProfile.push(
                      new THREE.Vector2(outerArr[i], points[i].Base)
                    );
                    innerProfile.push(
                      new THREE.Vector2(innerArr[i], points[i].Base)
                    );
                  }

                  const outerGeometry = new THREE.LatheGeometry(
                    outerProfile,
                    radialSegments
                  );
                  const innerGeometry = new THREE.LatheGeometry(
                    innerProfile,
                    radialSegments
                  );
                  innerGeometry.scale(1, 1, -1);

                  const outerMesh = new THREE.Mesh(
                    outerGeometry,
                    outerMaterial
                  );
                  const innerMesh = new THREE.Mesh(
                    innerGeometry,
                    innerMaterialForInnerSurface || outerMaterial
                  );

                  if (this._slicerEnabled && this._slicerPlane) {
                    this._applySlicerToMaterial(outerMesh.material);
                    this._applySlicerToMaterial(innerMesh.material);
                  }

                  return { outerMesh, innerMesh };
                };

                // -------------------------------------------------------------
                // Multi-layer thickness computation
                // -------------------------------------------------------------

                const P = this._normalizePercentages(
                  Array.isArray(this._layerPercentages)
                    ? this._layerPercentages
                    : [100]
                );
                const k = P.length;

                const L = [];
                for (let i = 0; i < k; i++)
                  L.push(new Array(points.length).fill(0));

                const minLayer = Number(this._minLayerThickness) || 0;

                for (let h = 0; h < points.length; h++) {
                  const Vh = Math.max(0, values[h]);
                  const Th = effectiveBasic + Vh;

                  const S = [];
                  for (let i = 0; i < k; i++) {
                    S[i] = (P[i] / 100) * Th;
                  }

                  const raw = [];
                  for (let i = 0; i < k; i++) {
                    if (i === 0) raw[i] = Math.max(0, S[0] - effectiveBasic);
                    else raw[i] = Math.max(0, S[i]);
                  }

                  let sumInner = raw.reduce((a, b) => a + b, 0);

                  if (sumInner > 0 && Math.abs(sumInner - Vh) > 1e-9) {
                    const scale = Vh / sumInner;
                    for (let i = 0; i < k; i++) raw[i] *= scale;
                    sumInner = Vh;
                  } else if (sumInner === 0 && Vh > 0) {
                    raw[k - 1] = Vh;
                    sumInner = Vh;
                  }

                  let deficit = 0;
                  for (let i = 0; i < k; i++) {
                    if (raw[i] > 0 && raw[i] < minLayer) {
                      deficit += raw[i];
                      raw[i] = 0;
                    }
                  }

                  if (deficit > 0 && Vh > 0) {
                    let idx = -1;
                    for (let i = k - 1; i >= 0; i--) {
                      if (raw[i] > 0) {
                        idx = i;
                        break;
                      }
                    }
                    if (idx === -1) idx = k - 1;
                    raw[idx] += deficit;
                  }

                  const finalSum = raw.reduce((a, b) => a + b, 0);
                  if (Vh > 0 && Math.abs(finalSum - Vh) > 1e-6) {
                    const scale = Vh / (finalSum || 1);
                    for (let i = 0; i < k; i++) raw[i] *= scale;
                  }

                  for (let i = 0; i < k; i++) {
                    L[i][h] = Math.max(0, raw[i]);
                  }
                }

                // -------------------------------------------------------------
                // Layer material generator
                // -------------------------------------------------------------

                const createLayerMaterial = (layerIndex1Based) => {
                  let css;
                  if (layerIndex1Based === 1) {
                    css = this._resolveSolidColor(
                      "ParisonVariableLayerBaseColor",
                      "black"
                    );
                  } else if (layerIndex1Based === 2) {
                    css = this._resolveSolidColor("ParisonLayer2Color", "grey");
                  } else if (layerIndex1Based === 3) {
                    css = this._resolveSolidColor(
                      "ParisonLayer3Color",
                      "white"
                    );
                  } else if (layerIndex1Based === 4) {
                    css = this._resolveSolidColor("ParisonLayer4Color", "blue");
                  } else if (layerIndex1Based === 5) {
                    css = this._resolveSolidColor("ParisonLayer5Color", "red");
                  } else {
                    css = this._resolveSolidColor(
                      "ParisonLayer3Color",
                      "#ff6600"
                    );
                  }

                  const mat = this._variableMaterial.clone();

                  const tmp = new THREE.Color();
                  tmp.setStyle(css);
                  mat.color.copy(tmp);

                  const alpha = Math.max(
                    1.0 - 0.1 * (layerIndex1Based - 1),
                    0.2
                  );
                  mat.opacity = alpha;
                  mat.transparent = true;
                  return mat;
                };

                this._layerGroup = new THREE.Group();

                // -------------------------------------------------------------
                // Build geometry based on dieGeometry
                // -------------------------------------------------------------

                const topPoint = points[points.length - 1];
                const bottomPoint = points[0];

                // -------------------------- PIN MOVE -------------------------

                if (this._dieGeometry === "PinMove") {
                  const candidateOuters = values.map(
                    (v) => spoolOuter + effectiveBasic + v
                  );
                  const maxTotal = Math.max(
                    ...candidateOuters,
                    effectiveBasic + 1
                  );

                  const baseOuter = maxTotal;

                  const basicInnerArr = [];
                  const basicOuterArr = [];

                  for (let i = 0; i < points.length; i++) {
                    const r_basic_outer = baseOuter;
                    const r_basic_inner = Math.max(
                      0,
                      r_basic_outer - effectiveBasic
                    );
                    basicOuterArr.push(r_basic_outer);
                    basicInnerArr.push(r_basic_inner);
                  }

                  const basicMeshes = createShellMeshes(
                    basicInnerArr,
                    basicOuterArr,
                    this._basicMaterial,
                    this._basicMaterial
                  );

                  this._basicOuterMesh = basicMeshes.outerMesh;
                  this._basicInnerMesh = basicMeshes.innerMesh;

                  this._basicOuterMesh.renderOrder = 0;
                  this._basicInnerMesh.renderOrder = 0;

                  const topCapBasic = this._createRingCap(
                    topPoint.Base,
                    basicOuterArr[basicOuterArr.length - 1],
                    basicInnerArr[basicInnerArr.length - 1],
                    radialSegments,
                    this._basicMaterial,
                    false
                  );

                  const bottomCapBasic = this._createRingCap(
                    bottomPoint.Base,
                    basicOuterArr[0],
                    basicInnerArr[0],
                    radialSegments,
                    this._basicMaterial,
                    true
                  );

                  topCapBasic.renderOrder = 0;
                  bottomCapBasic.renderOrder = 0;

                  const layerMeshes = [];
                  let prevOuterArr = basicInnerArr.slice();

                  for (let li = 0; li < k; li++) {
                    const thicknessArr = L[li];
                    const outerArr = [];
                    const innerArr = [];

                    for (let h = 0; h < points.length; h++) {
                      const r_outer = prevOuterArr[h];
                      const r_inner = Math.max(0, r_outer - thicknessArr[h]);
                      outerArr.push(r_outer);
                      innerArr.push(r_inner);
                    }

                    const layerMat = createLayerMaterial(li + 1);
                    const meshes = createShellMeshes(
                      innerArr,
                      outerArr,
                      layerMat,
                      this._innerMaterial
                    );

                    const order = li + 1;
                    meshes.outerMesh.renderOrder = order;
                    meshes.innerMesh.renderOrder = order;

                    const topCap = this._createRingCap(
                      topPoint.Base,
                      outerArr[outerArr.length - 1],
                      innerArr[innerArr.length - 1],
                      radialSegments,
                      layerMat,
                      false
                    );

                    const bottomCap = this._createRingCap(
                      bottomPoint.Base,
                      outerArr[0],
                      innerArr[0],
                      radialSegments,
                      layerMat,
                      true
                    );

                    topCap.renderOrder = order;
                    bottomCap.renderOrder = order;

                    layerMeshes.push({ meshes, topCap, bottomCap });

                    prevOuterArr = innerArr;
                  }

                  this._pipeGroup.add(this._basicOuterMesh);
                  this._pipeGroup.add(this._basicInnerMesh);
                  this._pipeGroup.add(topCapBasic);
                  this._pipeGroup.add(bottomCapBasic);

                  for (const lm of layerMeshes) {
                    this._layerGroup.add(lm.meshes.outerMesh);
                    this._layerGroup.add(lm.meshes.innerMesh);
                    this._layerGroup.add(lm.topCap);
                    this._layerGroup.add(lm.bottomCap);
                  }

                  this._pipeGroup.add(this._layerGroup);

                  const innermostArr = prevOuterArr;

                  this._dieOuterProfile = points.map(
                    (pt, idx) => new THREE.Vector2(basicOuterArr[idx], pt.Base)
                  );
                  this._dieInnerProfile = points.map(
                    (pt, idx) => new THREE.Vector2(innermostArr[idx], pt.Base)
                  );

                  
                }

                // -------------------------- DIE MOVE --------------------------
                else {
                  const spoolInnerArr = [];
                  const spoolOuterArr = [];
                  const basicInnerArr = [];
                  const basicOuterArr = [];

                  for (let i = 0; i < points.length; i++) {
                    spoolInnerArr.push(spoolInner);
                    spoolOuterArr.push(spoolOuter);
                    basicInnerArr.push(spoolOuter);
                    basicOuterArr.push(spoolOuter + effectiveBasic);
                  }

                  // Spool
                  const spoolMeshes = createShellMeshes(
                    spoolInnerArr,
                    spoolOuterArr,
                    this._spoolMaterial,
                    this._spoolMaterial
                  );
                  this._spoolOuterMesh = spoolMeshes.outerMesh;
                  this._spoolInnerMesh = spoolMeshes.innerMesh;
                  this._spoolOuterMesh.renderOrder = 0;
                  this._spoolInnerMesh.renderOrder = 0;

                  // Basic
                  const basicMeshes = createShellMeshes(
                    basicInnerArr,
                    basicOuterArr,
                    this._basicMaterial,
                    this._basicMaterial
                  );
                  this._basicOuterMesh = basicMeshes.outerMesh;
                  this._basicInnerMesh = basicMeshes.innerMesh;
                  this._basicOuterMesh.renderOrder = 1;
                  this._basicInnerMesh.renderOrder = 1;

                  // Caps
                  const topCapSpool = this._createRingCap(
                    topPoint.Base,
                    spoolOuterArr[spoolOuterArr.length - 1],
                    spoolInnerArr[spoolInnerArr.length - 1],
                    radialSegments,
                    this._spoolMaterial,
                    false
                  );
                  const bottomCapSpool = this._createRingCap(
                    bottomPoint.Base,
                    spoolOuterArr[0],
                    spoolInnerArr[0],
                    radialSegments,
                    this._spoolMaterial,
                    true
                  );
                  topCapSpool.renderOrder = 0;
                  bottomCapSpool.renderOrder = 0;

                  const topCapBasic = this._createRingCap(
                    topPoint.Base,
                    basicOuterArr[basicOuterArr.length - 1],
                    basicInnerArr[basicInnerArr.length - 1],
                    radialSegments,
                    this._basicMaterial,
                    false
                  );
                  const bottomCapBasic = this._createRingCap(
                    bottomPoint.Base,
                    basicOuterArr[0],
                    basicInnerArr[0],
                    radialSegments,
                    this._basicMaterial,
                    true
                  );
                  topCapBasic.renderOrder = 1;
                  bottomCapBasic.renderOrder = 1;

                  // Layers (grow outward)
                  const layerMeshes = [];

                  let prevInnerArr = basicOuterArr.slice();

                  for (let li = 0; li < k; li++) {
                    const thicknessArr = L[li];
                    const innerArr = [];
                    const outerArr = [];

                    for (let h = 0; h < points.length; h++) {
                      const r_inner = prevInnerArr[h];
                      const r_outer = Math.max(0, r_inner + thicknessArr[h]);
                      innerArr.push(r_inner);
                      outerArr.push(r_outer);
                    }

                    const layerMat = createLayerMaterial(li + 1);
                    const meshes = createShellMeshes(
                      innerArr,
                      outerArr,
                      layerMat,
                      this._innerMaterial
                    );

                    const order = 2 + li;
                    meshes.outerMesh.renderOrder = order;
                    meshes.innerMesh.renderOrder = order;

                    const topCap = this._createRingCap(
                      topPoint.Base,
                      outerArr[outerArr.length - 1],
                      innerArr[innerArr.length - 1],
                      radialSegments,
                      layerMat,
                      false
                    );
                    const bottomCap = this._createRingCap(
                      bottomPoint.Base,
                      outerArr[0],
                      innerArr[0],
                      radialSegments,
                      layerMat,
                      true
                    );

                    topCap.renderOrder = order;
                    bottomCap.renderOrder = order;

                    layerMeshes.push({ meshes, topCap, bottomCap });

                    prevInnerArr = outerArr;
                  }

                  // Add to scene in correct render order
                  this._pipeGroup.add(this._spoolOuterMesh);
                  this._pipeGroup.add(this._spoolInnerMesh);
                  this._pipeGroup.add(topCapSpool);
                  this._pipeGroup.add(bottomCapSpool);

                  this._pipeGroup.add(this._basicOuterMesh);
                  this._pipeGroup.add(this._basicInnerMesh);
                  this._pipeGroup.add(topCapBasic);
                  this._pipeGroup.add(bottomCapBasic);

                  for (const lm of layerMeshes) {
                    this._layerGroup.add(lm.meshes.outerMesh);
                    this._layerGroup.add(lm.meshes.innerMesh);
                    this._layerGroup.add(lm.topCap);
                    this._layerGroup.add(lm.bottomCap);
                  }
                  this._pipeGroup.add(this._layerGroup);

                  const outerProfileArr =
                    layerMeshes.length > 0 ? prevInnerArr : basicOuterArr;

                  this._dieOuterProfile = points.map(
                    (pt, idx) =>
                      new THREE.Vector2(outerProfileArr[idx], pt.Base)
                  );
                  this._dieInnerProfile = points.map(
                    (pt, idx) => new THREE.Vector2(spoolInnerArr[idx], pt.Base)
                  );

                  
                }

                this._updateSlicer();
              }

              _createRingCap(
                baseY,
                outerRadius,
                innerRadius,
                segments,
                material,
                flip
              ) {
                const capGeometry = new THREE.BufferGeometry();
                const vertices = [];
                const indices = [];

                for (let i = 0; i <= segments; i++) {
                  const angle = (i / segments) * Math.PI * 2;
                  const cos = Math.cos(angle);
                  const sin = Math.sin(angle);

                  const xOuter = outerRadius * cos;
                  const zOuter = outerRadius * sin;
                  const xInner = innerRadius * cos;
                  const zInner = innerRadius * sin;

                  vertices.push(xOuter, baseY, zOuter);
                  vertices.push(xInner, baseY, zInner);
                }

                for (let i = 0; i < segments; i++) {
                  const a = i * 2;
                  const b = a + 1;
                  const c = a + 2;
                  const d = a + 3;

                  if (flip) {
                    indices.push(a, d, b);
                    indices.push(a, c, d);
                  } else {
                    indices.push(a, b, d);
                    indices.push(a, d, c);
                  }
                }

                capGeometry.setIndex(indices);
                capGeometry.setAttribute(
                  "position",
                  new THREE.Float32BufferAttribute(vertices, 3)
                );
                capGeometry.computeVertexNormals();

                const mesh = new THREE.Mesh(capGeometry, material);
                mesh.material.side = THREE.DoubleSide;

                if (this._slicerEnabled && this._slicerPlane) {
                  this._applySlicerToMaterial(mesh.material);
                }

                return mesh;
              }

              // ---------------------------------------------------------------------
              // Slicer
              // ---------------------------------------------------------------------

              _applySlicerToMaterial(material) {
                if (!material) return;

                if (this._slicerEnabled && this._slicerPlane) {
                  material.clippingPlanes = [this._slicerPlane];
                  material.clipIntersection = false;
                  material.needsUpdate = true;
                } else {
                  material.clippingPlanes = [];
                  material.needsUpdate = true;
                }
              }

              _updateSlicer() {
                if (this._slicerPlane && this._pipeGroup) {
                  this._slicerPlane.constant = -this._pipeGroup.position.x;
                }

                if (this._renderer) {
                  this._renderer.localClippingEnabled = !!this._slicerEnabled;
                }

                const mats = [
                  this._spoolMaterial,
                  this._basicMaterial,
                  this._variableMaterial,
                  this._innerMaterial,
                ];
                mats.forEach((m) => {
                  if (m) this._applySlicerToMaterial(m);
                });

                const meshList = [
                  this._spoolOuterMesh,
                  this._spoolInnerMesh,
                  this._basicOuterMesh,
                  this._basicInnerMesh,
                  this._topCapSpool,
                  this._bottomCapSpool,
                  this._topCapBasic,
                  this._bottomCapBasic,
                ];

                meshList.forEach((mesh) => {
                  if (mesh && mesh.material) {
                    this._applySlicerToMaterial(mesh.material);
                  }
                });

                if (this._layerGroup) {
                  const stack = [this._layerGroup];
                  while (stack.length) {
                    const node = stack.pop();
                    if (node.material)
                      this._applySlicerToMaterial(node.material);
                    if (node.children && node.children.length) {
                      for (const c of node.children) stack.push(c);
                    }
                  }
                }
              }

              // Themed Resources

              _resolveSolidColor(resourceName, fallbackCss) {
                try {
                  const res = TcHmi.Theme.Resources.get(this, resourceName);
                  if (res && res.value) {
                    return TcHmi.StyleProvider.resolveSolidColorAsCssValue(
                      res.value
                    );
                  }
                } catch (e) {}
                return fallbackCss;
              }

              _resolveFloat(resourceName, fallbackVal) {
                try {
                  const res = TcHmi.Theme.Resources.get(this, resourceName);
                  if (res && typeof res.value === "number") {
                    return res.value;
                  }
                } catch (e) {}
                return fallbackVal;
              }

              _applyThemeColors() {
                if (!this._scene) return;

                const tmp = new THREE.Color();

                // ----------------------------
                // 1) Background
                // ----------------------------
                const bgCss = this._resolveSolidColor(
                  "Parison3DBackgroundColor",
                  "#d3d3d3"
                );
                tmp.setStyle(bgCss);
                this._scene.background = tmp;

                // ----------------------------
                // 2) Basic Layer Material
                // ----------------------------
                if (this._basicMaterial) {
                  const basicCss = this._resolveSolidColor(
                    "ParisonBasicLayerColor",
                    "rgba(70,130,180,0.9)"
                  );
                  tmp.setStyle(basicCss);
                  this._basicMaterial.color.copy(tmp);

                  let opacity = this._resolveFloat(
                    "ParisonBasicLayerOpacity",
                    NaN
                  );
                  if (!isFinite(opacity)) {
                    const m = basicCss.match(
                      /rgba?\([^,]+,[^,]+,[^,]+,([\d.]+)\)/
                    );
                    if (m) opacity = parseFloat(m[1]);
                  }
                  if (!isFinite(opacity)) opacity = 0.9;

                  this._basicMaterial.opacity = Math.min(
                    Math.max(opacity, 0),
                    1
                  );
                  this._basicMaterial.transparent =
                    this._basicMaterial.opacity < 1.0;
                  this._basicMaterial.needsUpdate = true;
                }

                // ----------------------------
                // 3) Variable Layer Base Color (Layer 1)
                // ----------------------------
                if (this._variableMaterial) {
                  const varCss = this._resolveSolidColor(
                    "ParisonVariableLayerBaseColor",
                    "#3b4a59"
                  );
                  tmp.setStyle(varCss);
                  this._variableMaterial.color.copy(tmp);
                  this._variableMaterial.needsUpdate = true;
                }

                // ----------------------------
                // 4) SPOOL inner surface color (FIXED)
                // ----------------------------
                if (this._spoolMaterial) {
                  const spoolCss = this._resolveSolidColor(
                    "ParisonSpoolColor",
                    "#3b4a59"
                  );
                  tmp.setStyle(spoolCss);
                  this._spoolMaterial.color.copy(tmp);
                  this._spoolMaterial.needsUpdate = true;
                }

                // ----------------------------
                // 5) Inner variable surface color (optional)
                // ----------------------------
                if (this._innerMaterial) {
                  // Uses the same theme OR define new one if needed
                  tmp.setStyle("#999999"); // optional neutral inner color
                  this._innerMaterial.color.copy(tmp);
                  this._innerMaterial.needsUpdate = true;
                }
              }

              
            }

            ParisonFramework.ParisonFrameworkControl = ParisonFrameworkControl;

        })(ParisonFramework = Controls.ParisonFramework || (Controls.ParisonFramework = {}));
    })(Controls = TcHmi.Controls || (TcHmi.Controls = {}));
})(TcHmi || (TcHmi = {}));

TcHmi.Controls.registerEx(
    "ParisonFrameworkControl",
    "TcHmi.Controls.ParisonFramework",
    TcHmi.Controls.ParisonFramework.ParisonFrameworkControl
);
