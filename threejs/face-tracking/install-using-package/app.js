import 'normalize.css';
import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  AnimationMixer,
  LoopRepeat,
  EquirectangularReflectionMapping,
  Quaternion
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import WAS, {
  ANCHOR_TYPE_NOSE_BRIDGE,
  DEVICE_ERROR,
  EVENT_DETECTED,
  EVENT_ERROR,
  EVENT_FRAME,
  EVENT_LOST,
  EVENT_SCREEN_ORIENTATION,
  EVENT_POSE,
  EVENT_PROCESS,
  EVENT_RESIZE,
  EVENT_VISIBILITY,
  GL_ERROR,
  HTML_ERROR,
  PROJECT_MODE_FACE,
  TRIGGER_MODE_FACE,
  VIDEO_ERROR,
  WORKER_ERROR,
} from '@web-ar-studio/webar-engine-sdk';

// Constants for camera settings
const CAMERA_FOV = 45;
const CAMERA_NEAR = 1;
const CAMERA_FAR = 100000;

// Getting reference to the container element
const container = document.querySelector('.App');

// Defining paths for the trigger, 3D model, and HDR environment map to create an augmented reality project example with a simple 3D model
const gltfSource = new URL('./assets/sunglasses.glb', import.meta.url).href;
const hdrSource = new URL('./assets/environment.hdr', import.meta.url).href;

// Checking if the container element exists
if (!container) {
  throw new Error('Element not found!');
}

// Creating a new instance of Web-AR.Studio SDK
const was = new WAS();

// Configuring Web-AR.Studio SDK with required settings
const configData = {
  apiKey: import.meta.env.VITE_API_KEY, //You can modify your API key in the .env file or specify it explicitly here. P.S. you can find more info in .env file
  mode: PROJECT_MODE_FACE,
  container: container,
  fov: CAMERA_FOV,
  near: CAMERA_NEAR,
  far: CAMERA_FAR,
  triggers: [{ id: 1, mode: TRIGGER_MODE_FACE, source: null }],
  anchor: ANCHOR_TYPE_NOSE_BRIDGE,
};

// Initializing Web-AR.Studio SDK
was
  .init(configData)
  .then(({ canvas, context, viewportSizes }) => {
    let model = null;
    let animationMixer = null;

    // Creating a WebGLRenderer
    const renderer = new WebGLRenderer({
      canvas: canvas,
      context: context || undefined,
      antialias: true,
      alpha: true,
    });

    // Setting renderer properties and size
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setViewport(
      -(viewportSizes.width / 2 - container.clientWidth / 2),
      -(viewportSizes.height / 2 - container.clientHeight / 2),
      viewportSizes.width,
      viewportSizes.height,
    );
    renderer.setClearColor(0xffffff, 0);
    renderer.clearColor();

    // Creating a Three.js scene
    const scene = new Scene();

    // Creating a PerspectiveCamera
    const camera = new PerspectiveCamera(
      CAMERA_FOV,
      viewportSizes.width / viewportSizes.height,
      CAMERA_NEAR,
      CAMERA_FAR,
    );

    // Adding camera and setting up event listeners
    scene.add(camera);

    // Loading HDR environment map
    const hdrPromise = new Promise((resolve, reject) => {
      const rgbeLoader = new RGBELoader();
      rgbeLoader.load(
        hdrSource,
        (dataTexture, texData) => {
          dataTexture.mapping = EquirectangularReflectionMapping;
          scene.environment = dataTexture;
          resolve();
        },
        (event) => {},
        (error) => {
          reject(error);
        },
      );
    });

    // Loading 3D model using GLTFLoader
    const gltfPromise = new Promise((resolve, reject) => {
      const gltfLoader = new GLTFLoader();
      gltfLoader.load(
        gltfSource,
        (gltf) => {
          model = gltf.scene;
          model.visible = false;
          scene.add(gltf.scene);

          // Setting up animations if available
          if (!gltf.animations.length) {
            return resolve();
          }

          animationMixer = new AnimationMixer(model);
          for (const animationClip of gltf.animations) {
            const action = animationMixer.clipAction(animationClip);
            action.setLoop(LoopRepeat, Infinity);
            action.play();
          }
          resolve();
        },
        (event) => {},
        (error) => {
          reject(error);
        },
      );
    });

    Promise.all([hdrPromise, gltfPromise]).then(() => {
      was
        .on(EVENT_DETECTED, (detectedData) => {
          for (const data of detectedData) {
            if (model) {
              model.visible = true;
              model.position.set(
                data.positionVector.x,
                data.positionVector.y,
                data.positionVector.z,
              );
              model.rotation.setFromQuaternion(
                new Quaternion(
                  data.rotationQuaternion.x,
                  data.rotationQuaternion.y,
                  data.rotationQuaternion.z,
                  data.rotationQuaternion.w
                )
              );
            }
          }
        })
        .catch((error) => {
          errorHandler(error);
        });

      // Handling model loss event
      was
        .on(EVENT_LOST, (lostData) => {
          for (const data of lostData) {
            if (model) {
              model.visible = false;
            }
          }
        })
        .catch((error) => {
          errorHandler(error);
        });

      // Handling pose update event
      was
        .on(EVENT_POSE, (poseData) => {
          for (const data of poseData) {
            if (model) {
              model.position.set(
                data.positionVector.x,
                data.positionVector.y,
                data.positionVector.z,
              );
              model.rotation.setFromQuaternion(
                new Quaternion(
                  data.rotationQuaternion.x,
                  data.rotationQuaternion.y,
                  data.rotationQuaternion.z,
                  data.rotationQuaternion.w
                )
              );
            }
          }
        })
        .catch((error) => {
          errorHandler(error);
        });

      // Handling process update event
      was
        .on(EVENT_PROCESS, (isProcess) => {})
        .catch((error) => {
          errorHandler(error);
        });

      // Handling resize event
      was
        .on(EVENT_RESIZE, (event) => {
          const viewportSizes = was.getViewportSizes();

          renderer.setSize(container.clientWidth, container.clientHeight);
          renderer.setViewport(
            -(viewportSizes.width / 2 - container.clientWidth / 2),
            -(viewportSizes.height / 2 - container.clientHeight / 2),
            viewportSizes.width,
            viewportSizes.height,
          );

          camera.aspect = viewportSizes.width / viewportSizes.height;
          camera.updateProjectionMatrix();
        })
        .catch((error) => {
          errorHandler(error);
        });

      // Handling orientation event
      was
        .on(EVENT_SCREEN_ORIENTATION, (angle) => {})
        .catch((error) => {
          errorHandler(error);
        });

      // Handling visibility event
      was
        .on(EVENT_VISIBILITY, (isVisible) => {})
        .catch((error) => {
          errorHandler(error);
        });

      // Handling frame update event
      was
        .on(EVENT_FRAME, (deltaTime) => {
          if (animationMixer) {
            animationMixer.update(deltaTime / 1000);
          }
          renderer.render(scene, camera);
        })
        .catch((error) => {
          errorHandler(error);
        });
    })
      .catch((error) => {
        errorHandler(error);
      });
  }).catch((error) => {
  errorHandler(error);
})

// Function to handle errors
const errorHandler = (error) => {
  switch (error.name) {
    case HTML_ERROR:
      // Handle HTML-related errors
      console.error(error);
      break;
    case DEVICE_ERROR:
      // Handle device-related errors
      window.alert("Device not found. Please open Devtools, select any device, and reload the page for local testing"); //You can remove this handling. It is solely for the convenience of understanding errors on the first run
      console.error(error);
      break;
    case VIDEO_ERROR:
      // Handle video-related errors
      window.alert("Camera access denied. Please allow camera access in the page settings and reload the page for local testing"); //You can remove this handling. It is solely for the convenience of understanding errors on the first run
      console.error(error);
      break;
    case GL_ERROR:
      // Handle WebGL-related errors
      console.error(error);
      break;
    case WORKER_ERROR:
      // Handle worker-related errors
      console.error(error);
      break;
    case EVENT_ERROR:
      // Handle event-related errors
      console.error(error);
      break;
    default:
      console.error(error);
  }
};