import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.121.1/build/three.module.js';
// import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.121.1/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.121.1/examples/jsm/controls/OrbitControls.js';

let camera, scene, renderer, mesh, controls;
let stars = [];

init();
animate();

function init() {
    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Camera setup
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
    camera.position.z =5;
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    // Create OrbitControls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.screenSpacePanning = false;
    controls.maxPolarAngle = Math.PI / 2;

    controls.zoomSpeed = 4;

    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    // Load the GLTF model
    const loader = new GLTFLoader();
    loader.load('./models/tesla/source/tesla_2018_model_3.glb', (gltf) => {
        mesh = gltf.scene; // Adjust scale as needed
        scene.add(mesh);

        // Traverse the model to assign materials and textures
        mesh.traverse((child) => {
            if (child.isMesh) {
                // Apply different textures to different parts of the model
                const textureIndex = Math.floor(Math.random() * 15); // Change 15 to the number of your textures
                const texture = new THREE.TextureLoader().load(`./models/texture/texture_${textureIndex}.jpg`);
                child.material.map = texture;
            }
        });
    });

    // Light setup
    const light = new THREE.DirectionalLight(0xFFFFFF, 2.5);
    light.position.set(50, 0, 50);
    light.target.position.set(0, 0, 0);
    light.castShadow = true;
    light.shadow.bias = -0.001;
    light.shadow.mapSize.width = 2048;
    light.shadow.mapSize.height = 2048;
    light.shadow.camera.near = 1.0;
    light.shadow.camera.far = 500.0;
    light.shadow.camera.left = -50;
    light.shadow.camera.right = 50;
    light.shadow.camera.top = 50;
    light.shadow.camera.bottom = -50;
    scene.add(light);

    const light1 = new THREE.AmbientLight(0xFFFFFF);
    scene.add(light1);

    // Stars setup
    for (let z = -1000; z < 2000; z += 20) {
        const geometryStar = new THREE.SphereGeometry(0.5, 32, 32);
        const materialStar = new THREE.MeshBasicMaterial({ color: 0xF4D03F });
        const sphereStar = new THREE.Mesh(geometryStar, materialStar);

        sphereStar.position.x = Math.random() * 1000 - 500;
        sphereStar.position.y = Math.random() * 1000 - 500;
        sphereStar.position.z = z;

        scene.add(sphereStar);
        stars.push(sphereStar);
    }

    // Event listeners
    window.addEventListener('resize', onWindowResize);

}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    //geometry rotate y-clockwise
    // mesh.rotation.y += 0.01;
    //scene.rotation.y += 0.001;
    //scene.rotation.z -= 0.001;

    // Update controls
    controls.update();

    for (let i = 0; i < stars.length; i++) {

        let star = stars[i];

        // and move it forward dependent on the mouseY position. 
        star.position.z += i / 20;

        // if the particle is too close move it to the back
        if (star.position.z > 1000) star.position.z -= 2000;

    }

    renderer.render(scene, camera);
}
