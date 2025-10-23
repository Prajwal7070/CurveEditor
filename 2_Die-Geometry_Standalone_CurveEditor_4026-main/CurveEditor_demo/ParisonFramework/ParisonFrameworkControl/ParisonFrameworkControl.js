/// <reference path="./../../Packages/Beckhoff.TwinCAT.HMI.Framework.14.3.178/runtimes/native1.12-tchmi/TcHmi.d.ts" />

var TcHmi;
(function (TcHmi) {
    let Controls;
    (function (Controls) {
        let ParisonFramework;
        (function (ParisonFramework) {

            class ParisonFrameworkControl extends TcHmi.Controls.System.TcHmiControl {

                constructor(element, pcElement, attrs) {
                    super(element, pcElement, attrs);

                    this.__elementTemplateRoot = null;

                    this._renderer = null;
                    this._scene = null;
                    this._camera = null;
                    this._controls = null;
                    this._animationId = null;

                    this._pipeGroup = null;
                    this._outerMesh = null;
                    this._innerMesh = null;
                    this._topCap = null;
                    this._bottomCap = null;

                    this._fixedPoints = [];

                    this._outerMaterial = null;
                    this._innerMaterial = null;

                    this._dieGeometry = 'DieMove';

                    // Store DieMove profiles to calculate thickness for PinMove if needed
                    this._dieOuterProfile = [];
                    this._dieInnerProfile = [];

                    this.__onResize = this.__onResize.bind(this);
                }

                __previnit() {
                    this.__elementTemplateRoot =
                        this.__element.find('.TcHmi_Controls_ParisonFramework_ParisonFrameworkControl-Template');
                    if (this.__elementTemplateRoot.length === 0) {
                        throw new Error('Invalid Template.html (root not found)');
                    }
                    super.__previnit();
                }

                __init() {
                    super.__init();
                }

                __attach() {
                    super.__attach();

                    if (typeof THREE === 'undefined') {
                        console.error('Three.js is not loaded! Add it in Description.json.');
                        return;
                    }
                    if (typeof THREE.OrbitControls === 'undefined') {
                        console.error('OrbitControls.js is not loaded! Add it in Description.json.');
                        return;
                    }

                    this._initThreeScene();

                    let initial = this.getFixedPoints();
                    if (!initial || (Array.isArray(initial) && initial.length === 0)) {
                        initial = this.getAttribute && this.getAttribute('data-tchmi-points');
                    }

                    const normalized = this._coerceFixedPointList(initial);
                    this._fixedPoints = normalized;

                    // Build DieMove first to store reference profiles
                    this._dieGeometry = 'DieMove';
                    this._buildFromPoints(normalized);

                    this._startRenderLoop();
                    this.__element.resize(this.__onResize);
                }

                __detach() {
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
                            if (this._renderer.forceContextLoss) this._renderer.forceContextLoss();
                            this._renderer.domElement = null;
                            this._renderer = null;
                        }
                        this._scene = null;
                        this._camera = null;
                        this._controls = null;
                        this._pipeGroup = null;
                        if (this.__element && this.__element.off) {
                            this.__element.off('resize', this.__onResize);
                        }
                    } finally {
                        super.destroy();
                    }
                }

                setFixedPoints(value) {
                    const list = this._coerceFixedPointList(value);
                    this._fixedPoints = list;
                    this._buildFromPoints(list);
                }

                getFixedPoints() {
                    return this._fixedPoints;
                }

                setDieGeometry(value) {
                    if (!value) return;
                    this._dieGeometry = value;
                    this._buildFromPoints(this._fixedPoints);
                }

                getDieGeometry() {
                    return this._dieGeometry;
                }

                _initThreeScene() {
                    const width = this.__elementTemplateRoot.width();
                    const height = this.__elementTemplateRoot.height();

                    this._scene = new THREE.Scene();
                    this._scene.background = new THREE.Color('#d3d3d3');

                    this._camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
                    this._camera.position.set(0, 150, 400);

                    this._renderer = new THREE.WebGLRenderer({ antialias: true });
                    this._renderer.setSize(width, height);
                    this._renderer.setPixelRatio(window.devicePixelRatio || 1);
                    this.__elementTemplateRoot.append(this._renderer.domElement);

                    this._controls = new THREE.OrbitControls(this._camera, this._renderer.domElement);
                    this._controls.enableDamping = true;
                    this._controls.dampingFactor = 0.05;
                    this._controls.enablePan = true;
                    this._controls.minDistance = 100;
                    this._controls.maxDistance = 800;

                    this._scene.add(new THREE.AmbientLight('white', 0.8));
                    const dirLight = new THREE.DirectionalLight('white', 1);
                    dirLight.position.set(200, 300, 300);
                    this._scene.add(dirLight);
                    const pointLight = new THREE.PointLight('white', 0.6);
                    pointLight.position.set(-150, 100, -150);
                    this._scene.add(pointLight);

                    this._outerMaterial = new THREE.MeshStandardMaterial({
                        color: '#607d8b',
                        transparent: true,
                        opacity: 0.7,
                        metalness: 0.2,
                        roughness: 0.2
                    });

                    this._innerMaterial = new THREE.MeshStandardMaterial({
                        color: 'white',
                        metalness: 0.1,
                        roughness: 0.6,
                        side: THREE.DoubleSide
                    });

                    this._pipeGroup = new THREE.Group();
                    this._pipeGroup.position.x = 50;
                    this._scene.add(this._pipeGroup);
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
                    if (!this._renderer || !this._camera || !this.__elementTemplateRoot) return;

                    const w = this.__elementTemplateRoot.width();
                    const h = this.__elementTemplateRoot.height();

                    this._camera.aspect = (h === 0) ? 1 : (w / h);
                    this._camera.updateProjectionMatrix();
                    this._renderer.setSize(w, h);
                }

                _coerceFixedPointList(input) {
                    try {
                        let val = input;
                        if (typeof val === 'string') {
                            val = JSON.parse(val);
                        }
                        if (!Array.isArray(val)) return [];

                        const out = [];
                        for (let i = 0; i < val.length; i++) {
                            const p = val[i] || {};
                            const base = this._toNumber(p.Base !== undefined ? p.Base : p.base);
                            const value = this._toNumber(p.Value !== undefined ? p.Value : p.value);
                            if (isFinite(base) && isFinite(value)) {
                                out.push({ Base: base, Value: value });
                            }
                        }
                        out.sort((a, b) => a.Base - b.Base);
                        return out;
                    } catch (e) {
                        console.warn('Invalid FixedPointList format:', e);
                        return [];
                    }
                }

                _toNumber(v) {
                    if (typeof v === 'number') return v;
                    if (typeof v === 'string' && v.trim() !== '') return Number(v);
                    return NaN;
                }

                // --- Fixed: Independent DieMove & PinMove, with correct per-point thickness preservation ---
                _buildFromPoints(points) {
                    if (!this._scene || !this._pipeGroup) return;

                    this._disposeParisonMeshes();
                    if (!points || points.length < 2) return;

                    const radialSegments = 64;
                    const thicknessSafety = 0.3;    // used to pick innerConst safely
                    const minThickness = 0.01;      // absolute minimum thickness to avoid collapsed geometry

                    let outerProfile = [];
                    let innerProfile = [];

                    // Precompute base arrays and outer values
                    const outerValues = points.map(p => p.Value);
                    const minOuter = Math.min(...outerValues);
                    const maxOuter = Math.max(...outerValues);

                    // innerConst represents the constant inner radius used in DieMove
                    const innerConst = Math.max(0, minOuter - thicknessSafety);

                    if (this._dieGeometry === 'DieMove') {
                        // DieMove: outer variable, inner constant
                        outerProfile = points.map(p => new THREE.Vector2(p.Value, p.Base));
                        innerProfile = points.map(p => new THREE.Vector2(innerConst, p.Base));

                        // Store reference profiles (optional, might be useful for debugging or later)
                        this._dieOuterProfile = outerProfile.map(v => v.clone());
                        this._dieInnerProfile = innerProfile.map(v => v.clone());

                    } else if (this._dieGeometry === 'PinMove') {
                        // PinMove: outer constant, inner variable
                        // Choose pinOuterConst — by default use minOuter (safe choice).
                        // You can replace this with a PLC-defined constantOuter if you prefer.
                        const pinOuterConst = minOuter;

                        for (let i = 0; i < points.length; i++) {
                            // IMPORTANT: thicknessAtPoint MUST match DieMove thickness at same Base:
                            // DieMove thickness would be: points[i].Value - innerConst
                            let thicknessAtPoint = points[i].Value - innerConst;

                            // enforce reasonable bounds
                            if (!isFinite(thicknessAtPoint) || thicknessAtPoint < minThickness) {
                                thicknessAtPoint = minThickness;
                            }

                            const outerX = pinOuterConst;
                            let innerX = outerX - thicknessAtPoint;

                            // Protect inner radius from going <= 0
                            if (innerX <= 0) innerX = minThickness;

                            outerProfile.push(new THREE.Vector2(outerX, points[i].Base));
                            innerProfile.push(new THREE.Vector2(innerX, points[i].Base));
                        }
                    }

                    // Build lathe geometries
                    const outerGeometry = new THREE.LatheGeometry(outerProfile, radialSegments);
                    const innerGeometry = new THREE.LatheGeometry(innerProfile, radialSegments);
                    innerGeometry.scale(1, 1, -1); // flip inner normals so inside is visible

                    this._outerMesh = new THREE.Mesh(outerGeometry, this._outerMaterial);
                    this._innerMesh = new THREE.Mesh(innerGeometry, this._innerMaterial);

                    const topPoint = points[points.length - 1];
                    const bottomPoint = points[0];

                    this._topCap = this._createRingCap(
                        topPoint.Base,
                        outerProfile[outerProfile.length - 1].x,
                        innerProfile[innerProfile.length - 1].x,
                        radialSegments,
                        this._innerMaterial,
                        false
                    );

                    this._bottomCap = this._createRingCap(
                        bottomPoint.Base,
                        outerProfile[0].x,
                        innerProfile[0].x,
                        radialSegments,
                        this._innerMaterial,
                        true
                    );

                    this._pipeGroup.add(this._outerMesh);
                    this._pipeGroup.add(this._innerMesh);
                    this._pipeGroup.add(this._topCap);
                    this._pipeGroup.add(this._bottomCap);
                }

                _createRingCap(baseY, outerRadius, innerRadius, segments, material, flip) {
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
                    capGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
                    capGeometry.computeVertexNormals();

                    const mesh = new THREE.Mesh(capGeometry, material);
                    mesh.material.side = THREE.DoubleSide;
                    return mesh;
                }

                _disposeParisonMeshes() {
                    if (this._pipeGroup) {
                        const toRemove = [];
                        this._pipeGroup.children.forEach(c => toRemove.push(c));
                        toRemove.forEach(c => {
                            this._pipeGroup.remove(c);
                            if (c.geometry) c.geometry.dispose();
                        });
                    }
                    this._outerMesh = null;
                    this._innerMesh = null;
                    this._topCap = null;
                    this._bottomCap = null;
                }
            }

            ParisonFramework.ParisonFrameworkControl = ParisonFrameworkControl;

        })(ParisonFramework = Controls.ParisonFramework || (Controls.ParisonFramework = {}));
    })(Controls = TcHmi.Controls || (TcHmi.Controls = {}));
})(TcHmi || (TcHmi = {}));

TcHmi.Controls.registerEx(
    'ParisonFrameworkControl',
    'TcHmi.Controls.ParisonFramework',
    TcHmi.Controls.ParisonFramework.ParisonFrameworkControl
);
