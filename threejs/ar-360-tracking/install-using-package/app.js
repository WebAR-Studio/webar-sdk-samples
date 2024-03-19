import 'normalize.css';
import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  EquirectangularReflectionMapping,
  Euler,
  Quaternion,
  Vector3
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import WAS, {
  DEVICE_ERROR,
  EVENT_DETECTED,
  EVENT_ERROR,
  EVENT_FRAME,
  EVENT_LOST,
  EVENT_DEVICE_ORIENTATION,
  EVENT_SCREEN_ORIENTATION,
  EVENT_POSE,
  EVENT_PROCESS,
  EVENT_RESIZE,
  EVENT_VISIBILITY,
  GL_ERROR,
  HTML_ERROR,
  PROJECT_MODE_SLAM_3DOF,
  VIDEO_ERROR,
  WORKER_ERROR,
} from '@web-ar-studio/webar-engine-sdk';

// Constants for camera settings
const CAMERA_FOV = 45;
const CAMERA_NEAR = 1;
const CAMERA_FAR = 100000;

// Getting reference to the container and button element
const container = document.querySelector('.App');
const button = document.querySelector('.Button');

// Defining paths for the trigger, 3D model, and HDR environment map to create an augmented reality project example with a simple 3D model
const gltfSource = new URL('./assets/controller.glb', import.meta.url).href;
const hdrSource = new URL('./assets/environment.hdr', import.meta.url).href;

// Checking if the container element exists
if (!container || !button) {
  throw new Error('Element not found!');
}

// Creating a new instance of Web-AR.Studio SDK
const was = new WAS();

// Configuring Web-AR.Studio SDK with required settings
const configData = {
  apiKey: import.meta.env.VITE_API_KEY, //You can modify your API key in the .env file or specify it explicitly here. P.S. you can find more info in .env file
  mode: PROJECT_MODE_SLAM_3DOF,
  container: container,
};

const convertingScreenAngle = (angle) => {
  if (angle === undefined) {
    angle =
      typeof screen.orientation !== 'undefined'
        ? screen.orientation.angle
        : window.orientation;
  }

  return angle === 270 ? -90 : angle;
}

const degreesToRadians = (degrees) => {
  return (degrees * Math.PI) / 180;
}

let currentAngle = convertingScreenAngle();

// Initializing Web-AR.Studio SDK
was
  .init(configData)
  .then(({ canvas, context, viewportSizes }) => {
    const EPS = 0.000001;
    const models = [];
    const countModels = 4;

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
          for (let i = 0; i < countModels; i++) {
            const model = gltf.scene.clone();
            models.push(model);

            model.visible = false;

            switch (i) {
              case 0:
                model.position.set(0, 0, -5);
                model.rotation.set(0, 0, 0);
                break;
              case 1:
                model.position.set(5, 0, 0);
                model.rotation.set(0, -Math.PI / 2, 0);
                break;
              case 2:
                model.position.set(-5, 0, 0);
                model.rotation.set(0, Math.PI / 2, 0);
                break;
              case 3:
                model.position.set(0, 0, 5);
                model.rotation.set(0, Math.PI, 0);
                break;

            }

            scene.add(model);
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
        .on(EVENT_DETECTED, (detectedData) => {})
        .catch((error) => {
          errorHandler(error);
        });

      // Handling model loss event
      was
        .on(EVENT_LOST, (lostData) => {})
        .catch((error) => {
          errorHandler(error);
        });

      // Handling pose update event
      was
        .on(EVENT_POSE, (poseData) => {})
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
        .on(EVENT_SCREEN_ORIENTATION, (angle) => {
          currentAngle = convertingScreenAngle(angle);
        })
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
          renderer.render(scene, camera);
        })
        .catch((error) => {
          errorHandler(error);
        });

      button.addEventListener('click', () => {
        button.classList.add('Button_hide');

        for (const model of models) {
          model.visible = true;
        }

        // Handling orientation event
        was
          .on(EVENT_DEVICE_ORIENTATION, (event) => {
            for (const model of models) {
              model.visible = true;
            }

            const alpha =
              event.alpha !== null ? degreesToRadians(event.alpha) : 0;
            const beta =
              event.beta !== null ? degreesToRadians(event.beta) : 0;
            const gamma =
              event.gamma !== null ? degreesToRadians(event.gamma) : 0;

            const euler = new Euler();
            const q0 = new Quaternion();
            const q1 = new Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
            const zee = new Vector3(0, 0, 1);


            euler.set(beta, alpha, -gamma, 'YXZ');
            camera.quaternion.setFromEuler(euler);
            camera.quaternion.multiply(q1);
            camera.quaternion.multiply(
              q0.setFromAxisAngle(zee, -degreesToRadians(currentAngle))
            );

            const lastQuaternion = new Quaternion();
            const quaternionDot = 8 * (1 - lastQuaternion.dot(camera.quaternion));
            if (quaternionDot > EPS) {
              lastQuaternion.copy(camera.quaternion);
            }
          })
          .catch((error) => {
            errorHandler(error);
          });
      }, false);
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