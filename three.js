// public/main.js
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
var renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('myCanvas') });
renderer.setSize(window.innerWidth, window.innerHeight);

var loader = new THREE.GLTFLoader();

loader.load('./models/tesla/scene.gltf', function (gltf) {
    var model = gltf.scene;
    var material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });

    model.traverse(function (child) {
        if (child.isMesh) {
            child.material = material;
        }
    });

    scene.add(model);

    var boundingBox = new THREE.Box3().setFromObject(model);
    var center = new THREE.Vector3();
    boundingBox.getCenter(center);

    camera.position.set(center.x, center.y, center.z + 5);
    camera.lookAt(center);
});

var directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

var ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

window.addEventListener('resize', function () {
    var newWidth = window.innerWidth;
    var newHeight = window.innerHeight;

    camera.aspect = newWidth / newHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(newWidth, newHeight);
});

animate();
