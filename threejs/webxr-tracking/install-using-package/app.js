import 'normalize.css';
import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  EquirectangularReflectionMapping,
  TextureLoader,
  PlaneGeometry,
  MeshBasicMaterial,
  DoubleSide,
  Mesh,
  Quaternion,
  Group,
  BoxGeometry
} from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import WAS, {
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
  EVENT_XR_SELECT,
  EVENT_XR_SESSION,
  EVENT_XR_ROTATE_START,
  EVENT_XR_ROTATE,
  EVENT_XR_PINCH_START,
  EVENT_XR_PINCH,
  EVENT_XR_PAN_START,
  EVENT_XR_PAN_MOVE,
  EVENT_XR_VIEWER_POSE,
  GL_ERROR,
  HTML_ERROR,
  PROJECT_MODE_SLAM_WEBXR,
  TRIGGER_MODE_SLAM_WEBXR,
  VIDEO_ERROR,
  WORKER_ERROR,
  XR_ERROR,
} from '@web-ar-studio/webar-engine-sdk';

// Constants for camera settings
const CAMERA_FOV = 45;
const CAMERA_NEAR = 1;
const CAMERA_FAR = 100000;

// Getting reference to the container and button element
const container = document.querySelector('.App');
const button = document.querySelector('.Button');
const image = document.querySelector('.Image');

// Defining paths for the trigger, 3D model, and HDR environment map to create an augmented reality project example with a simple 3D model
const hdrSource = new URL('./assets/environment.hdr', import.meta.url).href;
const markerSource = new URL('./assets/marker.png', import.meta.url).href;

// Checking if the container element exists
if (!container || !button || !image) {
  throw new Error('Element not found!');
}

// Creating a new instance of Web-AR.Studio SDK
const was = new WAS();

// Configuring Web-AR.Studio SDK with required settings
const configData = {
  apiKey: import.meta.env.VITE_API_KEY, //You can modify your API key in the .env file or specify it explicitly here. P.S. you can find more info in .env file
  mode: PROJECT_MODE_SLAM_WEBXR,
  container: container,
  uiContainer: container,
  triggers: [{ id: 1, mode: TRIGGER_MODE_SLAM_WEBXR, source: null }],
};

let isActiveWebXR = false;

// Initializing Web-AR.Studio SDK
was
  .init(configData)
  .then(({ canvas, context, viewportSizes }) => {
    let isTracking = false;
    let positionVector = { x: 0, y: 0, z: 0 };
    let rotationQuaternion = { x: 0, y: 0, z: 0, w: 1 };
    let scaleVector= { x: 0, y: 0, z: 0 };

    let group = new Group();
    group.visible = false;

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
    scene.add(group);

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

    const markerPromise = new Promise((resolve, reject) => {
      const textureLoader = new TextureLoader();
      textureLoader.load(
        markerSource,
        (texture) => {
          const geometry = new PlaneGeometry(0.3, 0.3);
          const material = new MeshBasicMaterial({
            side: DoubleSide,
            transparent: true,
            map: texture,
          });
          const marker = new Mesh(geometry, material);
          marker.rotation.x = -Math.PI / 2;
          group.add(marker);
          resolve();
        },
        (event) => {},
        (error) => {
          reject(error);
        },
      );
    });

    Promise.all([hdrPromise, markerPromise]).then(() => {
      was
        .on(EVENT_DETECTED, (detectedData) => {
          isTracking = true;

          group.visible = true;
          image.classList.add('Image_hide');
        })
        .catch((error) => {
          errorHandler(error);
        });

      // Handling model loss event
      was
        .on(EVENT_LOST, (lostData) => {
          isTracking = false;

          group.visible = false;
          image.classList.remove('Image_hide');
        })
        .catch((error) => {
          errorHandler(error);
        });

      // Handling pose update event
      was
        .on(EVENT_POSE, (poseData) => {
          for (const data of poseData) {
            positionVector = data.positionVector;
            rotationQuaternion = data.rotationQuaternion;
            scaleVector = data.scaleVector;

            group.position.set(
              positionVector.x,
              positionVector.y,
              positionVector.z,
            );
            group.rotation.setFromQuaternion(
              new Quaternion(
                rotationQuaternion.x,
                rotationQuaternion.y,
                rotationQuaternion.z,
                rotationQuaternion.w,
              ),
            );
            group.scale.set(
              scaleVector.x,
              scaleVector.y,
              scaleVector.z,
            );
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

      // Handling xr session update event
      was
        .on(EVENT_XR_SESSION, (isActive) => {})
        .catch((error) => {
          errorHandler(error);
        });

      // Handling xr select update event
      was
        .on(EVENT_XR_SELECT, () => {
          if (!isTracking) {
            return;
          }

          const geometry = new BoxGeometry(0.1, 0.1, 0.1);
          const material = new MeshBasicMaterial({ color: '#ffff00' });
          const mesh = new Mesh(geometry, material);

          mesh.position.set(
            positionVector.x,
            positionVector.y + 0.05,
            positionVector.z
          );
          mesh.rotation.setFromQuaternion(
            new Quaternion(
              rotationQuaternion.x,
              rotationQuaternion.y,
              rotationQuaternion.z,
              rotationQuaternion.w
            )
          );
          mesh.scale.set(scaleVector.x, scaleVector.y, scaleVector.z);

          scene.add(mesh);
        })
        .catch((error) => {
          errorHandler(error);
        });

      // Handling xr rotate start update event
      was
        .on(EVENT_XR_ROTATE_START, (event) => {})
        .catch((error) => {
          errorHandler(error);
        });

      // Handling xr rotate update event
      was
        .on(EVENT_XR_ROTATE, (event) => {})
        .catch((error) => {
          errorHandler(error);
        });

      // Handling xr pinch start update event
      was
        .on(EVENT_XR_PINCH_START, (event) => {})
        .catch((error) => {
          errorHandler(error);
        });

      // Handling xr pinch update event
      was
        .on(EVENT_XR_PINCH, (event) => {})
        .catch((error) => {
          errorHandler(error);
        });

      // Handling xr pan start update event
      was
        .on(EVENT_XR_PAN_START, (event) => {})
        .catch((error) => {
          errorHandler(error);
        });

      // Handling xr pan move update event
      was
        .on(EVENT_XR_PAN_MOVE, (event) => {})
        .catch((error) => {
          errorHandler(error);
        });

      // Handling xr viewer pose update event
      was
        .on(EVENT_XR_VIEWER_POSE, (XRViewerPose) => {
          if (XRViewerPose) {
            const viewportSizes = was.getViewportSizes();

            renderer.setSize(was.getSizes().width, was.getSizes().height);
            renderer.setViewport(
              -(viewportSizes.width / 2 - was.getSizes().width / 2),
              -(viewportSizes.height / 2 - was.getSizes().height / 2),
              viewportSizes.width,
              viewportSizes.height
            );

            camera.position.set(
              XRViewerPose.positionVector.x,
              XRViewerPose.positionVector.y,
              XRViewerPose.positionVector.z
            );
            camera.rotation.setFromQuaternion(
              new Quaternion(
                XRViewerPose.rotationQuaternion.x,
                XRViewerPose.rotationQuaternion.y,
                XRViewerPose.rotationQuaternion.z,
                XRViewerPose.rotationQuaternion.w
              )
            );
            camera.scale.set(
              XRViewerPose.scaleVector.x,
              XRViewerPose.scaleVector.y,
              XRViewerPose.scaleVector.z
            );
            camera.projectionMatrix.fromArray(XRViewerPose.projectionMatrix);
          }
        })
        .catch((error) => {
          errorHandler(error);
        });

      // Handling resize event
      was
        .on(EVENT_RESIZE, (event) => {})
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
      button.addEventListener('click', () => {
        isActiveWebXR = !isActiveWebXR;
        button.innerText = isActiveWebXR ? 'Close WebXR session' : 'Activate WebXR session';

        if (!isActiveWebXR) {
          location.reload();
        }

        // Handling frame update event
        was
          .on(EVENT_FRAME, (deltaTime) => {
            renderer.render(scene, camera);
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
    case XR_ERROR:
      // Handle xr-related errors
      console.error(error);
      break;
    default:
      console.error(error);
  }
};