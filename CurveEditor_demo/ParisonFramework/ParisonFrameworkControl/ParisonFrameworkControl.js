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

                    this._spoolOuterMesh = null;
                    this._spoolInnerMesh = null;
                    this._basicOuterMesh = null;
                    this._basicInnerMesh = null;
                    this._variableOuterMesh = null;
                    this._variableInnerMesh = null;

                    this._topCapSpool = null;
                    this._bottomCapSpool = null;
                    this._topCapBasic = null;
                    this._bottomCapBasic = null;
                    this._topCapVariable = null;
                    this._bottomCapVariable = null;

                    this._fixedPoints = [];

                    // Materials
                    this._spoolMaterial = null;
                    this._basicMaterial = null;
                    this._variableMaterial = null;
                    this._innerMaterial = null;

                    // attributes (defaults)
                    this._visualBasicThickness = 3.0;
                    this._minVisualBasicThickness = 1.0;
                    this._spoolCoreThickness = 2.0;
                    this._spoolCoreInner = 5.0;

                    this._dieGeometry = 'DieMove';
                    this._dieOuterProfile = [];
                    this._dieInnerProfile = [];

                    this.__onResize = this.__onResize.bind(this);
                }

                __previnit() {
                    this.__elementTemplateRoot = this.__element.find(
                        '.TcHmi_Controls_ParisonFramework_ParisonFrameworkControl-Template'
                    );
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
                            this.__element.off('resize', this.__onResize);
                        }
                    } finally {
                        super.destroy();
                    }
                }

                // -------------------------
                // Public API
                // -------------------------

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

                // attribute accessors (match Description.json)
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

                // -------------------------
                // Three.js Scene Setup
                // -------------------------

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

                    // Lights
                    this._scene.add(new THREE.AmbientLight('white', 0.8));

                    const dirLight = new THREE.DirectionalLight('white', 1);
                    dirLight.position.set(200, 300, 300);
                    this._scene.add(dirLight);

                    const pointLight = new THREE.PointLight('white', 0.6);
                    pointLight.position.set(-150, 100, -150);
                    this._scene.add(pointLight);

                    // Materials
                    this._spoolMaterial = new THREE.MeshStandardMaterial({
                        color: 'yellow',
                        metalness: 0.2,
                        roughness: 0.4,
                        side: THREE.DoubleSide
                    });

                    this._basicMaterial = new THREE.MeshStandardMaterial({
                        color: '#1976d2', // blue basic band
                        transparent: true,
                        opacity: 0.9,
                        metalness: 0.1,
                        roughness: 0.5,
                        side: THREE.DoubleSide
                    });

                    this._variableMaterial = new THREE.MeshStandardMaterial({
                        color: '#e53935', // red variable band
                        transparent: true,
                        opacity: 0.85,
                        metalness: 0.05,
                        roughness: 0.6,
                        side: THREE.DoubleSide
                    });

                    this._innerMaterial = new THREE.MeshStandardMaterial({
                        color: '#e53935',
                        metalness: 0.1,
                        roughness: 0.6,
                        side: THREE.DoubleSide
                    });

                    // Group
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

                // -------------------------
                // Data Helpers
                // -------------------------

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

                // -------------------------
                // Geometry Builders
                // -------------------------

                _buildFromPoints(points) {
                    if (!this._scene || !this._pipeGroup) return;

                    this._disposeParisonMeshes();
                    if (!points || points.length < 2) return;

                    const radialSegments = 64;
                    const thicknessSafety = 0.3;
                    const minThickness = 0.01;

                    // read attributes
                    const visualBasic = Math.max(
                        Number(this._visualBasicThickness),
                        Number(this._minVisualBasicThickness)
                    );
                    const minVisualBasic = Number(this._minVisualBasicThickness) || 0.01;
                    const spoolInner = Number(this._spoolCoreInner) || 0;
                    const spoolThickness = Number(this._spoolCoreThickness) || 0;
                    const spoolOuter = spoolInner + spoolThickness;

                    // collect outer values for mode decisions
                    const outerValues = points.map(p => p.Value);
                    const minOuter = Math.min(...outerValues);

                    // For PinMove original logic used pinOuterConst = minOuter
                    const pinOuterConst = minOuter;

                    // compute a die-inner reference (used in derivation)
                    const innerConst = Math.max(0, minOuter - thicknessSafety);

                    // Arrays that will hold radii per sample
                    const spoolInnerArr = [];
                    const spoolOuterArr = [];
                    const basicInnerArr = [];
                    const basicOuterArr = [];
                    const varInnerArr = [];
                    const varOuterArr = [];

                    // Helper to create lathe shell (outer + inner) and return meshes.
                    // You can pass different materials for outer and inner surfaces (innerMaterial will be used for inner inverted geometry).
                    const createShellMeshes = (innerArr, outerArr, outerMaterial, innerMaterialForInnerSurface) => {
                        const outerProfile = [];
                        const innerProfile = [];
                        for (let i = 0; i < points.length; i++) {
                            outerProfile.push(new THREE.Vector2(outerArr[i], points[i].Base));
                            innerProfile.push(new THREE.Vector2(innerArr[i], points[i].Base));
                        }
                        const outerGeometry = new THREE.LatheGeometry(outerProfile, radialSegments);
                        const innerGeometry = new THREE.LatheGeometry(innerProfile, radialSegments);
                        innerGeometry.scale(1, 1, -1); // invert normals for inner side

                        const outerMesh = new THREE.Mesh(outerGeometry, outerMaterial);
                        const innerMesh = new THREE.Mesh(innerGeometry, innerMaterialForInnerSurface || outerMaterial);

                        return { outerMesh, innerMesh };
                    };

                    // Build depending on dieGeometry
                    if (this._dieGeometry === 'PinMove') {
                        // PIN MOVE: Outer is constant (pinOuterConst), inner varies.
                        // Per mentor: remove spool core for PinMove; basic thickness sits on the outer side (thin blue band).
                        // The inner surface should be white and variable.

                        const effectiveBasic = Math.max(visualBasic, minVisualBasic);

                        for (let i = 0; i < points.length; i++) {
                            const p = points[i];

                            // preserve original PinMove thickness calculation
                            let thicknessAtPoint = p.Value - innerConst;
                            if (!isFinite(thicknessAtPoint) || thicknessAtPoint < minThickness) {
                                thicknessAtPoint = minThickness;
                            }

                            const outerConst = pinOuterConst;
                            const desiredInner = outerConst - thicknessAtPoint;
                            const r_var_inner = Math.max(desiredInner, minThickness); // inner boundary of variable band (cannot go below 0)
                            const r_basic_outer = outerConst;
                            const r_basic_inner = Math.max(r_basic_outer - effectiveBasic, r_var_inner); // ensure basic inner not inside variable inner

                            // variable outer is the inner face of the basic band
                            const r_var_outer = r_basic_inner;

                            // push arrays
                            // Note: spool arrays kept empty / zero since spool removed for PinMove
                            spoolInnerArr.push(0);
                            spoolOuterArr.push(0);

                            basicInnerArr.push(r_basic_inner);
                            basicOuterArr.push(r_basic_outer);

                            varInnerArr.push(r_var_inner);
                            varOuterArr.push(r_var_outer);
                        }

                        // CREATE meshes:
                        // Basic band (outermost blue) - both faces blue
                        const basicMeshes = createShellMeshes(basicInnerArr, basicOuterArr, this._basicMaterial, this._basicMaterial);
                        this._basicOuterMesh = basicMeshes.outerMesh;
                        this._basicInnerMesh = basicMeshes.innerMesh;

                        // Variable band (red) outer face red, **inner face white** (so inner wall appears white)
                        const variableMeshes = createShellMeshes(varInnerArr, varOuterArr, this._variableMaterial, this._innerMaterial);
                        this._variableOuterMesh = variableMeshes.outerMesh;
                        this._variableInnerMesh = variableMeshes.innerMesh;

                        // For a visible inner "white" inner surface of the parison (the hollow wall), we already used the variable inner mesh's innerMaterial = white.
                        // No spool meshes are added.

                        // Caps:
                        const topPoint = points[points.length - 1];
                        const bottomPoint = points[0];

                        // Basic caps (outer side) - use basicMaterial for visibility
                        this._topCapBasic = this._createRingCap(
                            topPoint.Base,
                            basicOuterArr[basicOuterArr.length - 1],
                            basicInnerArr[basicInnerArr.length - 1],
                            radialSegments,
                            this._basicMaterial,
                            false
                        );

                        this._bottomCapBasic = this._createRingCap(
                            bottomPoint.Base,
                            basicOuterArr[0],
                            basicInnerArr[0],
                            radialSegments,
                            this._basicMaterial,
                            true
                        );

                        // Variable caps - use innerMaterial (white) so inner face looks white on caps
                        this._topCapVariable = this._createRingCap(
                            topPoint.Base,
                            varOuterArr[varOuterArr.length - 1],
                            varInnerArr[varInnerArr.length - 1],
                            radialSegments,
                            this._innerMaterial,
                            false
                        );

                        this._bottomCapVariable = this._createRingCap(
                            bottomPoint.Base,
                            varOuterArr[0],
                            varInnerArr[0],
                            radialSegments,
                            this._innerMaterial,
                            true
                        );

                        // Add to group in order inner -> outer to help render layering
                        this._pipeGroup.add(this._variableOuterMesh);
                        this._pipeGroup.add(this._variableInnerMesh);
                        this._pipeGroup.add(this._topCapVariable);
                        this._pipeGroup.add(this._bottomCapVariable);

                        this._pipeGroup.add(this._basicOuterMesh);
                        this._pipeGroup.add(this._basicInnerMesh);
                        this._pipeGroup.add(this._topCapBasic);
                        this._pipeGroup.add(this._bottomCapBasic);

                        // Update die profiles for reference
                        this._dieOuterProfile = points.map(v => new THREE.Vector2(pinOuterConst, v.Base));
                        this._dieInnerProfile = points.map((pt, idx) => {
                            const desired = pinOuterConst - (pt.Value - innerConst);
                            return new THREE.Vector2(desired, pt.Base);
                        });

                    } else {
                        // DIE MOVE: keep previous behaviour: outer variable, inner constant (innerConst)
                        // spool + basic + variable stack (spool is inner-most)
                        for (let i = 0; i < points.length; i++) {
                            const p = points[i];
                            let outerSetpoint = p.Value;
                            if (!isFinite(outerSetpoint)) outerSetpoint = 0;

                            const effectiveBasic = Math.max(visualBasic, minVisualBasic);

                            // variable thickness computed as: outerSetpoint - spoolOuter - basic
                            let variable = outerSetpoint - spoolOuter - effectiveBasic;
                            if (!isFinite(variable) || variable < 0) variable = 0;
                            if (variable < minThickness) variable = Math.max(0, variable);

                            // assemble radii
                            const r_spool_inner = spoolInner;
                            const r_spool_outer = spoolOuter;

                            const r_basic_inner = r_spool_outer;
                            const r_basic_outer = r_spool_outer + effectiveBasic;

                            const r_var_inner = r_basic_outer;
                            const r_var_outer = r_basic_outer + variable;

                            spoolInnerArr.push(r_spool_inner);
                            spoolOuterArr.push(r_spool_outer);

                            basicInnerArr.push(r_basic_inner);
                            basicOuterArr.push(r_basic_outer);

                            varInnerArr.push(r_var_inner);
                            varOuterArr.push(r_var_outer);
                        }

                        // spool meshes (both faces spoolMaterial)
                        const spoolMeshes = createShellMeshes(spoolInnerArr, spoolOuterArr, this._spoolMaterial, this._spoolMaterial);
                        this._spoolOuterMesh = spoolMeshes.outerMesh;
                        this._spoolInnerMesh = spoolMeshes.innerMesh;

                        // basic meshes
                        const basicMeshes = createShellMeshes(basicInnerArr, basicOuterArr, this._basicMaterial, this._basicMaterial);
                        this._basicOuterMesh = basicMeshes.outerMesh;
                        this._basicInnerMesh = basicMeshes.innerMesh;

                        // variable meshes (outer red, inner white)
                        const variableMeshes = createShellMeshes(varInnerArr, varOuterArr, this._variableMaterial, this._innerMaterial);
                        this._variableOuterMesh = variableMeshes.outerMesh;
                        this._variableInnerMesh = variableMeshes.innerMesh;

                        // Caps:
                        const topPoint = points[points.length - 1];
                        const bottomPoint = points[0];

                        // spool caps
                        this._topCapSpool = this._createRingCap(
                            topPoint.Base,
                            spoolOuterArr[spoolOuterArr.length - 1],
                            spoolInnerArr[spoolInnerArr.length - 1],
                            radialSegments,
                            this._spoolMaterial,
                            false
                        );

                        this._bottomCapSpool = this._createRingCap(
                            bottomPoint.Base,
                            spoolOuterArr[0],
                            spoolInnerArr[0],
                            radialSegments,
                            this._spoolMaterial,
                            true
                        );

                        // basic caps
                        this._topCapBasic = this._createRingCap(
                            topPoint.Base,
                            basicOuterArr[basicOuterArr.length - 1],
                            basicInnerArr[basicInnerArr.length - 1],
                            radialSegments,
                            this._basicMaterial,
                            false
                        );

                        this._bottomCapBasic = this._createRingCap(
                            bottomPoint.Base,
                            basicOuterArr[0],
                            basicInnerArr[0],
                            radialSegments,
                            this._basicMaterial,
                            true
                        );

                        // variable caps (inner white)
                        this._topCapVariable = this._createRingCap(
                            topPoint.Base,
                            varOuterArr[varOuterArr.length - 1],
                            varInnerArr[varInnerArr.length - 1],
                            radialSegments,
                            this._innerMaterial,
                            false
                        );

                        this._bottomCapVariable = this._createRingCap(
                            bottomPoint.Base,
                            varOuterArr[0],
                            varInnerArr[0],
                            radialSegments,
                            this._innerMaterial,
                            true
                        );

                        // Add to group in order inner -> outer
                        this._pipeGroup.add(this._spoolOuterMesh);
                        this._pipeGroup.add(this._spoolInnerMesh);
                        this._pipeGroup.add(this._topCapSpool);
                        this._pipeGroup.add(this._bottomCapSpool);

                        this._pipeGroup.add(this._basicOuterMesh);
                        this._pipeGroup.add(this._basicInnerMesh);
                        this._pipeGroup.add(this._topCapBasic);
                        this._pipeGroup.add(this._bottomCapBasic);

                        this._pipeGroup.add(this._variableOuterMesh);
                        this._pipeGroup.add(this._variableInnerMesh);
                        this._pipeGroup.add(this._topCapVariable);
                        this._pipeGroup.add(this._bottomCapVariable);

                        // store profiles
                        this._dieOuterProfile = points.map((pt, idx) => new THREE.Vector2(varOuterArr[idx], pt.Base));
                        this._dieInnerProfile = points.map((pt, idx) => new THREE.Vector2(spoolInnerArr[idx], pt.Base));
                    }
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
                    capGeometry.setAttribute(
                        'position',
                        new THREE.Float32BufferAttribute(vertices, 3)
                    );
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

                    // clear references
                    this._outerMesh = null;
                    this._innerMesh = null;
                    this._topCap = null;
                    this._bottomCap = null;

                    this._spoolOuterMesh = null;
                    this._spoolInnerMesh = null;
                    this._basicOuterMesh = null;
                    this._basicInnerMesh = null;
                    this._variableOuterMesh = null;
                    this._variableInnerMesh = null;

                    this._topCapSpool = null;
                    this._bottomCapSpool = null;
                    this._topCapBasic = null;
                    this._bottomCapBasic = null;
                    this._topCapVariable = null;
                    this._bottomCapVariable = null;
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
