import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.121.1/build/three.module.js';

import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.118/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.118/examples/jsm/loaders/GLTFLoader.js';
import Stats from 'https://cdn.jsdelivr.net/npm/three@0.118/examples/jsm/libs/stats.module.js';


let camera, scene, renderer;
let mesh;
let sphere;
let stats;
let spheres = [];

init();
animate();

function init() {

    //create & initialize a renderer(WebGL)
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    // locate at the body tag
    document.body.appendChild(renderer.domElement);

    //camera setting
    const fov = 80;
    const aspect = 1920 / 1080;
    const near = 0.1;
    const far = 200.0;

    camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    camera.position.set(-10, 70, -80); // Set position like this
    camera.lookAt(new THREE.Vector3(mesh)); // Set look at coordinate like this

    scene = new THREE.Scene();

    //light setting
    let light = new THREE.DirectionalLight(0xFFFFFF, 2.0);
    light.position.set(100, 100, 10);
    light.target.position.set(0, 0, 0);
    light.castShadow = true;
    light.shadow.bias = -0.001;
    light.shadow.mapSize.width = 2048;
    light.shadow.mapSize.height = 2048;
    light.shadow.camera.near = 1.0;
    light.shadow.camera.far = 500.0;
    light.shadow.camera.near = 0.5;
    light.shadow.camera.far = 500.0;
    light.shadow.camera.left = 100;
    light.shadow.camera.right = -100;
    light.shadow.camera.top = 100;
    light.shadow.camera.bottom = -100;
    scene.add(light);

    let light1 = new THREE.AmbientLight(0x101010);
    scene.add(light1);

    const loader = new THREE.TextureLoader();
    const texture = loader.load('./models/helix/textures/material_baseColor.jpeg', function(texture) {

        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

    });

    const material = new THREE.ShaderMaterial({
        specular: 0x111111,
        shininess: 10,
        map: texture
    });

    const loader1 = new GLTFLoader();
    loader1.load('./models/helix/scene.gltf', (gltf) => {
        gltf.scene.traverse(c => {
            c.castShadow = false;
            c.position.set(0, 0, 0);
            c.scale.setScalar(2.3);
        });
        mesh = gltf.scene;
        mesh.material = material;
        scene.add(mesh);


    });


    for (let i = 1; i < 600; i++) {
        const geometry1 = new THREE.SphereGeometry(0.17 * randomArbitrary(0.5, 1), 6, 6);
        const material1 = new THREE.MeshBasicMaterial({
            color: new THREE.Color(1, randomArbitrary(200, 250) / 155, Math.round(Math.random()))
        });

        sphere = new THREE.Mesh(geometry1, material1);
        scene.add(sphere);
        spheres.push(sphere);
        sphere.position.setFromSpherical(new THREE.Spherical(70 + 70 * Math.random(), 8 * Math.PI * Math.random(), 8 * Math.PI * Math.random()))

    }

    stats = new Stats();

    window.addEventListener('resize', onWindowResize);

}

//running with any sized window
function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);

}

//animation function
function animate() {

    requestAnimationFrame(animate);

    //geometry rotate y-clockwise
    mesh.rotation.y += 0.01;

    scene.rotation.y -= 0.001;
    scene.rotation.z -= 0.001;

    renderer.render(scene, camera);

}

function randomArbitrary(min, max) {
    return Math.random() * (max - min) + min;
}