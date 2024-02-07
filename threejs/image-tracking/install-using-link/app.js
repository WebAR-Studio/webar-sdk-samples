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
  ANCHOR_TYPE_CENTER,
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
  PROJECT_MODE_IMAGE,
  TRIGGER_MODE_IMAGE,
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
const triggerSource = new URL('./assets/trigger.jpg', import.meta.url).href;
const gltfSource = new URL('./assets/skyscraper.glb', import.meta.url).href;
const hdrSource = new URL('./assets/environment.hdr', import.meta.url).href;

// Checking if the container element exists
if (!container) {
  throw new Error('Element not found!');
}

// Creating a new instance of Web-AR.Studio SDK
const was = new WAS();

// Configuring Web-AR.Studio SDK with required settings
// Each AR project has 2 keys: one for local testing and the other - public. Use the public key for the final build
// You can create your own API KEY on the web-ar.studio platform or you can write our team directly https://t.me/was_team
// You can use this Test Key for demo use only in local testing: 52f80541de1715ba47f43522d648d0800c6e514d8b5e91b9b6e13ef9e1348cb8
const configData = {
  apiKey: '52f80541de1715ba47f43522d648d0800c6e514d8b5e91b9b6e13ef9e1348cb8',
  mode: PROJECT_MODE_IMAGE,
  container: container,
  fov: CAMERA_FOV,
  triggers: [{ id: 1, mode: TRIGGER_MODE_IMAGE, source: triggerSource }],
  isMultiTracking: true,
  anchor: ANCHOR_TYPE_CENTER,
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

    // Loading HDR environment map
    const rgbeLoader = new RGBELoader();
    rgbeLoader.load(
      hdrSource,
      (dataTexture, texData) => {
        dataTexture.mapping = EquirectangularReflectionMapping;
        scene.environment = dataTexture;
      },
      (event) => {},
      (error) => {
        console.error(error);
      },
    );

    // Creating a PerspectiveCamera
    const camera = new PerspectiveCamera(
      CAMERA_FOV,
      viewportSizes.width / viewportSizes.height,
      CAMERA_NEAR,
      CAMERA_FAR,
    );

    // Loading 3D model using GLTFLoader
    const gltfLoader = new GLTFLoader();
    gltfLoader.load(
      gltfSource,
      (gltf) => {
        model = gltf.scene;
        model.visible = false;
        scene.add(gltf.scene);

        // Setting up animations if available
        if (!gltf.animations.length) {
          return;
        }

        animationMixer = new AnimationMixer(model);
        for (const animationClip of gltf.animations) {
          const action = animationMixer.clipAction(animationClip);
          action.setLoop(LoopRepeat, Infinity);
          action.play();
        }
      },
      (event) => {},
      (error) => {
        console.error(error);
      },
    );

    // Adding camera and setting up event listeners
    scene.add(camera);
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

// Function to handle errors
const errorHandler = (error) => {
  switch (error.name) {
    case HTML_ERROR:
      // Handle HTML-related errors
      break;
    case DEVICE_ERROR:
      // Handle device-related errors
      break;
    case VIDEO_ERROR:
      // Handle video-related errors
      break;
    case GL_ERROR:
      // Handle WebGL-related errors
      break;
    case WORKER_ERROR:
      // Handle worker-related errors
      break;
    case EVENT_ERROR:
      // Handle event-related errors
      break;
  }
};
