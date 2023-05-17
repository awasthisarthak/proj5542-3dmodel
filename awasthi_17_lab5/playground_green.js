
//References
// WebGLFundamentals Lesson on Textures: https://webglfundamentals.org/webgl/lessons/webgl-3d-textures.html
// WebGL Fundamentals Lesson on SkyBox: https://webglfundamentals.org/webgl/lessons/webgl-skybox.html
// teapot.json from Dr. Hanqi Guo's WebGL-tutorial: https://github.com/hguo/WebGL-tutorial/blob/master/teapot.json
// gl-matrix-min.js: https://cdnjs.cloudflare.com/ajax/libs/gl-matrix/2.8.1/gl-matrix-min.js

// Vertex shader
const vertexShaderSource = `
  attribute vec3 aPosition;
  attribute vec3 aNormal;
  uniform mat4 uModelViewMatrix;
  uniform mat4 uProjectionMatrix;
  uniform mat3 uNormalMatrix;
  varying vec3 vNormal;
  attribute vec2 aTextureCoord;
  varying vec2 vTextureCoord;
  uniform vec2 uTextureTranslation;
  // uniform float uTextureRotation;
  varying vec3 vPosition;
  void main() {
    vPosition = aPosition;
    gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
    vNormal = uNormalMatrix * aNormal;
    vTextureCoord = aTextureCoord;
  }
`;

// Fragment shader
const fragmentShaderSource = `
  precision mediump float;
  varying vec3 vNormal;
  uniform vec3 uColor;
  uniform vec3 uLightPosition;
  uniform vec3 uAmbientCoefficient;
  uniform vec3 uDiffuseCoefficient;
  uniform vec3 uSpecularCoefficient;
  uniform float uShininess;
  uniform float lightIntensity;
  varying vec2 vTextureCoord;
  uniform sampler2D uTextureSampler;
  uniform bool useTexture;
  uniform samplerCube uSkybox;
  varying vec3 vPosition;
  uniform bool useCubemap;
  uniform float uReflectionCoefficient;

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 lightDirection = normalize(uLightPosition);

    // Ambient
    vec3 ambient = uAmbientCoefficient * uColor;

    // Diffuse
    float diff = max(dot(normal, lightDirection), 0.0);
    vec3 diffuse = diff * uColor * uDiffuseCoefficient * lightIntensity;

    // Specular
    vec3 viewDirection = normalize(-vec3(gl_FragCoord));
    vec3 reflectDirection = reflect(-lightDirection, normal);
    float spec = pow(max(dot(viewDirection, reflectDirection), 0.0), uShininess);
    vec3 specular = uSpecularCoefficient * spec * uColor;

    // Compute reflection vector
    viewDirection = normalize(-vPosition);
    vec3 reflectionVector = reflect(viewDirection, normal);

    // Compute reflected color
    vec4 reflectedColor = textureCube(uSkybox, reflectionVector);

    if (useTexture && !useCubemap) {
      vec4 textureColor = texture2D(uTextureSampler, vTextureCoord);
      // Combine reflected color with the existing color based on the reflection coefficient
      gl_FragColor = mix(textureColor, reflectedColor, uReflectionCoefficient);
    } else if (useCubemap) {
        vec3 direction = normalize(vPosition - vec3(0.0, 0.0, 0.0));
        gl_FragColor = textureCube(uSkybox, direction);
    } else {
      vec4 baseColor = vec4(ambient + diffuse + specular, 1.0);
      gl_FragColor = mix(baseColor, reflectedColor, uReflectionCoefficient);
    }
  }
`;

// Helper function to create shader
function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("An error occurred compiling the shaders: " + gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

// Helper function to create program
function createProgram(gl, vertexShader, fragmentShader) {
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Unable to initialize the shader program: " + gl.getProgramInfoLog(program));
    return null;
  }
  return program;
}

// Helper function to create VBO
function createVBO(gl, data) {
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
  return vbo;
}

// Helper function to store indices of vertices
function storeIndex(gl, data) {
  const index = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data), gl.STATIC_DRAW);
  return index;
}

// Helper function to create cylinder mesh
function createCylinder(gl, baseRadius, topRadius, height, numSlices, numStacks, color) {
  const positions = [];
  const normals = [];
  const indices = [];

  for (let stack = 0; stack <= numStacks; stack++) {
    const stackFactor = stack / numStacks;
    const stackRadius = baseRadius + (topRadius - baseRadius) * stackFactor;
    const stackHeight = height * stackFactor;

    for (let slice = 0; slice <= numSlices; slice++) {
      const angle = (slice * 2 * Math.PI) / numSlices;
      const x = stackRadius * Math.cos(angle);
      const z = stackRadius * Math.sin(angle);
      const normalX = x / Math.sqrt(x * x + z * z);
      const normalZ = z / Math.sqrt(x * x + z * z);

      positions.push(x, stackHeight, z);
      normals.push(normalX, 0, normalZ);
    }
  }

  for (let stack = 0; stack < numStacks; stack++) {
    for (let slice = 0; slice < numSlices; slice++) {
      const i0 = (stack * (numSlices + 1)) + slice;
      const i1 = i0 + 1;
      const i2 = i0 + numSlices + 1;
      const i3 = i2 + 1;

      indices.push(i0, i1, i2, i1, i3, i2);
    }
  }

  const vboPosition = createVBO(gl, positions);
  const vboNormal = createVBO(gl, normals);
  const index = storeIndex(gl, indices);

  return {
    numElements: indices.length,
    vboPosition: vboPosition,
    vboNormal: vboNormal,
    index: index,
  };
}

// Helper function to create cube mesh
function createCube(gl, size, color) {
    const positions = [
      // Front face
      -size, -size, size,
      size, -size, size,
      size, size, size,
      -size, size, size,
  
      // Back face
      -size, -size, -size,
      -size, size, -size,
      size, size, -size,
      size, -size, -size,
  
      // Top face
      -size, size, -size,
      -size, size, size,
      size, size, size,
      size, size, -size,
  
      // Bottom face
      -size, -size, -size,
      size, -size, -size,
      size, -size, size,
      -size, -size, size,
  
      // Right face
      size, -size, -size,
      size, size, -size,
      size, size, size,
      size, -size, size,
  
      // Left face
      -size, -size, -size,
      -size, -size, size,
      -size, size, size,
      -size, size, -size,
    ];
  
    const normals = [
      // Front face
      0, 0, 1,
      0, 0, 1,
      0, 0, 1,
      0, 0, 1,
  
      // Back face
      0, 0, -1,
      0, 0, -1,
      0, 0, -1,
      0, 0, -1,
  
      // Top face
      0, 1, 0,
      0, 1, 0,
      0, 1, 0,
      0, 1, 0,
  
      // Bottom face
      0, -1, 0,
      0, -1, 0,
      0, -1, 0,
      0, -1, 0,
  
      // Right face
      1, 0, 0,
      1, 0, 0,
      1, 0, 0,
      1, 0, 0,
  
      // Left face
      -1, 0, 0,
      -1, 0, 0,
      -1, 0, 0,
      -1, 0, 0,
    ];
  
    const indices = [
      0, 1, 2, 0, 2, 3, // front
      4, 5, 6, 4, 6, 7, // back
      8, 9, 10, 8, 10, 11, // top
      12, 13, 14, 12, 14, 15, // bottom
      16, 17, 18, 16, 18, 19, // right
      20, 21, 22, 20, 22, 23, // left
    ];

    const vboPosition = createVBO(gl, positions);
    const vboNormal = createVBO(gl, normals);

    const index = storeIndex(gl, indices);

    return {
      numElements: indices.length,
      vboPosition: vboPosition,
      vboNormal: vboNormal,
      index: index,
    };
  }

// Helper function to create sphere mesh
function createSphere(gl, radius, numSlices, numStacks, color) {
  const positions = [];
  const normals = [];
  const indices = [];

  for (let stack = 0; stack <= numStacks; stack++) {
    const theta = (stack * Math.PI) / numStacks;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let slice = 0; slice <= numSlices; slice++) {
      const phi = (slice * 2 * Math.PI) / numSlices;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      const x = cosPhi * sinTheta;
      const y = cosTheta;
      const z = sinPhi * sinTheta;

      positions.push(radius * x, radius * y, radius * z);
      normals.push(x, y, z);
    }
  }

  for (let stack = 0; stack < numStacks; stack++) {
    for (let slice = 0; slice < numSlices; slice++) {
      const i0 = (stack * (numSlices + 1)) + slice;
      const i1 = i0 + 1;
      const i2 = i0 + numSlices + 1;
      const i3 = i2 + 1;
      indices.push(i0, i1, i2, i1, i3, i2);
    }
  }

  const vboPosition = createVBO(gl, positions);
  const vboNormal = createVBO(gl, normals);
  const index = storeIndex(gl, indices);

  return {
    numElements: indices.length,
    vboPosition: vboPosition,
    vboNormal: vboNormal,
    index: index,
  };
}
  
// Initialize WebGL
const canvas = document.createElement("canvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
document.body.appendChild(canvas);
  
const gl = canvas.getContext("webgl");
if (!gl) {
  console.error("WebGL not supported");
  throw new Error("WebGL not supported");
}
  
// Compile shaders and create program
const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
const program = createProgram(gl, vertexShader, fragmentShader);
gl.useProgram(program);
  
// Create VBOs and store corresponding indices for cube, cylinder, and sphere for different shapes
const ground = createCube(gl, 5);
const slide = createCylinder(gl, 0.5, 0.5, 5, 8, 1); 
const swing = createCylinder(gl, 1, 1, 1, 32, 1); 
const trunk = createCylinder(gl, 1, 1, 1, 32, 1); 
const sittingBench = createCube(gl, 1);
const ladder = createCylinder(gl, 0.1, 0.1, 5.8, 32, 1); 
const sticks = createCylinder(gl, 0.1, 0.1, 2.0, 32, 1); 
const pole = createCube(gl, 1);
const moon = createSphere(gl, 1, 32, 32);
const head = createSphere(gl, 1.0, 20, 20);
const torso = createCylinder(gl, 0.8, 0.8, 2.0, 20, 2); 
const limb = createCylinder(gl, 0.4, 0.4, 2.0, 20, 2);

// Get attribute and uniform locations
const aPosition = gl.getAttribLocation(program, "aPosition");
const aNormal = gl.getAttribLocation(program, "aNormal");
const uModelViewMatrix = gl.getUniformLocation(program, "uModelViewMatrix");
const uProjectionMatrix = gl.getUniformLocation(program, "uProjectionMatrix");
const uNormalMatrix = gl.getUniformLocation(program, "uNormalMatrix");
const uColor = gl.getUniformLocation(program, "uColor");
const aTextureCoord = gl.getAttribLocation(program, "aTextureCoord");
const uTextureSampler = gl.getUniformLocation(program, "uTextureSampler");
const uUseTexture = gl.getUniformLocation(program, "useTexture");
const uUseCubemap = gl.getUniformLocation(program, "useCubemap");
const uSkybox = gl.getUniformLocation(program, "uSkybox");
const uReflectionCoefficient = gl.getUniformLocation(program, "uReflectionCoefficient");

// Set reflection coefficient
const reflectionCoefficient = 0.4;
gl.uniform1f(uReflectionCoefficient, reflectionCoefficient);

// Add light properties
const lightPosition = vec3.fromValues(-12, 5, 10);
const ambientCoefficient = vec3.fromValues(0.5, 0.5, 0.5);
const diffuseCoefficient = vec3.fromValues(0.8, 0.8, 0.8);
const specularCoefficient = vec3.fromValues(0.9, 0.9, 0.9);

// Get uniform locations for light properties
const uLightPosition = gl.getUniformLocation(program, "uLightPosition");
const uAmbientCoefficient = gl.getUniformLocation(program, "uAmbientCoefficient");
const uDiffuseCoefficient = gl.getUniformLocation(program, "uDiffuseCoefficient");
const uSpecularCoefficient = gl.getUniformLocation(program, "uSpecularCoefficient");
const uShininess = gl.getUniformLocation(program, "uShininess");
const uLightIntensity = gl.getUniformLocation(program, "lightIntensity");

// Set uniform values for light properties
gl.uniform3fv(uAmbientCoefficient, ambientCoefficient);
gl.uniform3fv(uDiffuseCoefficient, diffuseCoefficient);
gl.uniform3fv(uSpecularCoefficient, specularCoefficient);
gl.uniform3fv(uLightPosition, lightPosition);
gl.uniform1f(uShininess, 32.0); 
gl.uniform1f(uLightIntensity, 2.0);
  
// Set up perspective projection matrix
const projectionMatrix = mat4.create();
mat4.perspective(projectionMatrix, Math.PI / 4, canvas.width / canvas.height, 0.1, 100);

// Set up view matrix
const viewMatrix = mat4.create();
mat4.lookAt(viewMatrix, [20, 10, 20], [0, -1, 0], [0, 1, 0]);

// Enable depth testing
gl.enable(gl.DEPTH_TEST);
gl.depthFunc(gl.LEQUAL);

const headPosition = vec3.fromValues(0, 0.2, 0); // Initial position of the head (x, y, z)
const torsoPosition = vec3.fromValues(0, -2.5, 0); // Initial position of the body (x, y, z)
const poleScale = vec3.fromValues(0.5, -3, 0.5);

// Draw limbs of humanoid
const limbs = [
  {
    position: [-0.8, -2.5, 0],
    rotation: Math.PI / 2, // 45 degrees
  }, // Left arm
  {
    position: [0.8, -2.5, 0],
    rotation: Math.PI / 2, // -45 degrees
  }, // Right arm
  {
    position: [-0.8, -4.5, 0],
    rotation: 0,
  }, // Left leg
  {
    position: [0.8, -4.5, 0],
    rotation: 0,
  }, // Right leg
];

let cameraPitch = 0;
let cameraYaw = 0;
let cameraRoll = 0;

//Initialize swing position and moving mode flag
let swingPosition = [9, -2.5, 1];
let swingMovingMode = false;
let humanoidMovingMode = true;

window.addEventListener('keydown', (event) => {
  if (event.key === 'm') {
    swingMovingMode = !swingMovingMode; // Toggle swing moving mode
    humanoidMovingMode = !humanoidMovingMode;
  }

  if (swingMovingMode) {
    switch (event.key) {
      case 'w':
        swingPosition[2] -= 0.1;
        break;
      case 's':
        swingPosition[2] += 0.1;
        break;
      case 'a':
        swingPosition[0] -= 0.1;
        break;
      case 'd':
        swingPosition[0] += 0.1;
        break;
    }
  }
  const moveSpeed = 0.1;
  const rotationSpeed = 0.05;
  if (humanoidMovingMode){
  switch (event.key) {
    case 'w':
    case 'W':
      headPosition[2] += moveSpeed;
      torsoPosition[2] +=moveSpeed;
      limbs.forEach((limbData) => {
        limbData.position[2] +=moveSpeed;
      });
      break;
    case 's':
    case 'S':
      headPosition[2] -= moveSpeed;
      torsoPosition[2] -=moveSpeed;
      limbs.forEach((limbData) => {
        limbData.position[2] -=moveSpeed;
      });
      break;
    case 'a':
    case 'A':
      headPosition[0] += moveSpeed;
      torsoPosition[0] +=moveSpeed;
      limbs.forEach((limbData) => {
        limbData.position[0] +=moveSpeed;
      });
      break;
    case 'd':
    case 'D':
      headPosition[0] -= moveSpeed;
      torsoPosition[0] -=moveSpeed;
      limbs.forEach((limbData) => {
        limbData.position[0] -=moveSpeed;
      });
      break;
  }}
  switch (event.key) {
    case 'P':
      cameraPitch += rotationSpeed;
      break;
    case 'p':
      cameraPitch -= rotationSpeed;
      break;
    case 'Y':
      cameraYaw += rotationSpeed;
      break;
    case 'y':
      cameraYaw -= rotationSpeed;
      break;
    case 'R':
      cameraRoll -= rotationSpeed;
      break;
    case 'r':
      cameraRoll += rotationSpeed;
      break;
  }
});

async function initSkybox(gl) {
  // skybox vertex data
  const vertices = [
    // Front
    -1, -1, 1,
    1, -1, 1,
    1, 1, 1,
    -1, 1, 1,
    // Back
    -1, -1, -1,
    1, -1, -1,
    1, 1, -1,
    -1, 1, -1,
    // Left
    -1, -1, -1,
    -1, -1, 1,
    -1, 1, 1,
    -1, 1, -1,
    // Right
    1, -1, -1,
    1, -1, 1,
    1, 1, 1,
    1, 1, -1,
    // Top
    -1, 1, 1,
    1, 1, 1,
    1, 1, -1,
    -1, 1, -1,
    // Bottom
    -1, -1, 1,
    1, -1, 1,
    1, -1, -1,
    -1, -1, -1,
  ];

  // skybox index data
  const indices = [
    // Front
    0, 1, 2,
    0, 2, 3,
    // Back
    4, 5, 6,
    4, 6, 7,
    // Left
    8, 9, 10,
    8, 10, 11,
    // Right
    12, 13, 14,
    12, 14, 15,
    // Top
    16, 17, 18,
    16, 18, 19,
    // Bottom
    20, 21, 22,
    20, 22, 23,
  ];

  const vboPosition = createVBO(gl, vertices);
  const index = storeIndex(gl, indices);

  // Load textures for each face of the cube map
  const skyboxTextures = [
    "posx.jpg",
    "negx.jpg",
    "posy.jpg",
    "negy.jpg",
    "posz.jpg",
    "negz.jpg",
  ];  

  const texturePromise = loadCubemapTexture(gl, skyboxTextures.map(tex => `textures/Lycksele3/${tex}`));
  const skyboxTexture = await texturePromise;
  
  return {
  numElements: indices.length,
  vboPosition: vboPosition,
  textures: skyboxTexture,
  index: index,
  };
}

async function loadCubemapTexture(gl, imagePaths) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);

  const faceTargets = [
    gl.TEXTURE_CUBE_MAP_POSITIVE_X,
    gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
    gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
    gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
    gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
    gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
  ];

  const imagePromises = imagePaths.map((path, i) => {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.src = path;
      image.onload = () => {
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(faceTargets[i], 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        resolve();
      };
      image.onerror = () => {
        reject(new Error(`Failed to load image: ${path}`));
      };
    });
  });

  await Promise.all(imagePromises);

  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return texture;
}

async function loadTeapotModel() {
  const response = await fetch("teapot.json");
  const model = await response.json();
  return model;
}

function initTeapotModel(gl, model, texture) {
  const vertexPositions = model.vertexPositions;
  const vertexNormals = model.vertexNormals;
  const vertexTextureCoords = model.vertexTextureCoords;
  const indices = model.indices;

  const vboPosition = createVBO(gl, vertexPositions);
  const vboNormal = createVBO(gl, vertexNormals);
  const vboTexture = createVBO(gl, vertexTextureCoords);
  const index = storeIndex(gl, indices);

  return {
    numElements: indices.length,
    vboPosition: vboPosition,
    vboNormal: vboNormal,
    vboTexture: vboTexture,
    index: index,
    texture: texture,
  };
}

async function loadTexture(gl, url) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  const img = new Image();
  img.src = url;
  await new Promise((resolve) => {
    img.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      resolve();
    };
  });
  return texture;
}

async function main() {
  // Load teapot model data and texture
  const teapotModelData = await loadTeapotModel();
  const teapotTexture = await loadTexture(gl, "textures/earth.png");

  // Initialize the teapot model
  const teapot = initTeapotModel(gl, teapotModelData, teapotTexture);

  // Initialize and draw the skybox
  const skybox = await initSkybox(gl);

  function render() {
    drawTeapot(gl, teapot, uModelViewMatrix, uNormalMatrix);
    drawSkybox(gl, skybox, uSkybox);
    // Set the depth function to LESS, so the skybox is drawn behind other objects
    gl.depthFunc(gl.LESS);
    requestAnimationFrame(render);
  }
  render();
}

function drawTeapot(gl, teapot, uModelViewMatrix, uNormalMatrix) {
  const modelMatrix = mat4.create();

  // Set the model transformation for the teapot
  mat4.translate(modelMatrix, modelMatrix, [8, -2, 8]);
  mat4.scale(modelMatrix, modelMatrix, [0.1, 0.1, 0.1]);

  // Update the model-view and normal matrices
  const modelViewMatrix = mat4.create();
  mat4.multiply(modelViewMatrix, viewMatrix, modelMatrix);
  const normalMatrix = mat3.normalFromMat4(mat3.create(), modelViewMatrix);

  // Set the attribute pointers and draw the teapot
  gl.bindBuffer(gl.ARRAY_BUFFER, teapot.vboPosition);
  gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aPosition);

  gl.bindBuffer(gl.ARRAY_BUFFER, teapot.vboNormal);
  gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aNormal);

  gl.bindBuffer(gl.ARRAY_BUFFER, teapot.vboTexture);
  gl.vertexAttribPointer(aTextureCoord, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aTextureCoord);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, teapot.index);

  gl.uniformMatrix4fv(uModelViewMatrix, false, modelViewMatrix);
  gl.uniformMatrix3fv(uNormalMatrix, false, normalMatrix);

  // Set the texture sampler uniform and bind the teapot texture
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, teapot.texture);
  gl.uniform1i(uTextureSampler, 0);

  // Set the useTexture flag to true for the teapot
  gl.uniform1i(uUseTexture, true);

  gl.drawElements(gl.TRIANGLES, teapot.numElements, gl.UNSIGNED_SHORT, 0);

  // Set the useTexture flag back to false for other objects
  gl.uniform1i(uUseTexture, false);

  // Unbind and disable the texture after drawing the teapot model
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.disableVertexAttribArray(aTextureCoord);
}

function drawSkybox(gl, skybox, uSkybox) {
  const wallModelMatrix = mat4.create();
  mat4.scale(wallModelMatrix, wallModelMatrix, [40, 40, 40]);

  gl.bindBuffer(gl.ARRAY_BUFFER, skybox.vboPosition);
  gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aPosition);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, skybox.index);

  // Bind the cubemap texture
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, skybox.textures);
  gl.uniform1i(uSkybox, 1);

  const modelViewMatrix = mat4.create();
  mat4.multiply(modelViewMatrix, viewMatrix, wallModelMatrix);
  const normalMatrix = mat3.normalFromMat4(mat3.create(), modelViewMatrix);

  gl.uniformMatrix4fv(uModelViewMatrix, false, modelViewMatrix);
  gl.uniformMatrix3fv(uNormalMatrix, false, normalMatrix);

  // Use cubemap
  gl.uniform1i(uUseTexture, false);
  gl.uniform1i(uUseCubemap, true);

  gl.drawElements(gl.TRIANGLES, skybox.numElements, gl.UNSIGNED_SHORT, 0);

  // Reset texture usage
  gl.uniform1i(uUseTexture, false);
  gl.uniform1i(uUseCubemap, false);
  // Set the depth function back to LEQUAL
  gl.depthFunc(gl.LEQUAL);
}
main();

function drawBodyPart(gl, modelMatrix, viewMatrix, part, color) {
  gl.bindBuffer(gl.ARRAY_BUFFER, part.vboPosition);
  gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aPosition);

  gl.bindBuffer(gl.ARRAY_BUFFER, part.vboNormal);
  gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aNormal);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, part.index);

  const modelViewMatrix = mat4.create();
  mat4.multiply(modelViewMatrix, viewMatrix, modelMatrix);

  const normalMatrix = mat3.create();
  mat3.normalFromMat4(normalMatrix, modelViewMatrix);

  gl.uniformMatrix4fv(uModelViewMatrix, false, modelViewMatrix);
  gl.uniformMatrix3fv(uNormalMatrix, false, normalMatrix);
  gl.uniform3fv(uColor, color);

  gl.drawElements(gl.TRIANGLES, part.numElements, gl.UNSIGNED_SHORT, 0);
}  

// Update the view matrix based on pitch/yaw/roll
function updateViewMatrix() {
  const cameraPosition = [20, 10, 20];
  const cameraTarget = [0, -1, 0];
  const cameraUp = [0, 1, 0];

  const pitchMatrix = mat4.create();
  const yawMatrix = mat4.create();
  const rollMatrix = mat4.create();

  mat4.rotateX(pitchMatrix, pitchMatrix, cameraPitch);
  mat4.rotateY(yawMatrix, yawMatrix, cameraYaw);
  mat4.rotateZ(rollMatrix, rollMatrix, cameraRoll);

  const rotationMatrix = mat4.create();
  mat4.multiply(rotationMatrix, yawMatrix, pitchMatrix);
  mat4.multiply(rotationMatrix, rotationMatrix, rollMatrix);

  const rotatedCameraPosition = vec3.create();
  vec3.transformMat4(rotatedCameraPosition, cameraPosition, rotationMatrix);
  mat4.lookAt(viewMatrix, rotatedCameraPosition, cameraTarget, cameraUp);
}  

// Function to update the model matrix with rotation
function updateModelMatrixWithRotation(modelMatrix, time, rotationAxis, rotationSpeed) {
  mat4.rotate(modelMatrix, modelMatrix, time * rotationSpeed, rotationAxis);
}

// Function to update the model matrix with revolution
function updateModelMatrixWithRevolution(modelMatrix, time, revolutionRadius, revolutionSpeed) {
  const angle = time * revolutionSpeed;
  const x = revolutionRadius * Math.cos(angle);
  const z = revolutionRadius * Math.sin(angle);
  mat4.translate(modelMatrix, modelMatrix, [x, 0, z]);
}

// Function to generate color values based on time
function getColorValue(time) {
  return (Math.sin(time) + 1) / 2;
}

// Function to get the position of the moon from the model matrix
function getMoonPosition(modelMatrix) {
  const position = vec3.create();
  vec3.transformMat4(position, position, modelMatrix);
  return position;
}

// Render loop
function render() {
  const time = performance.now() * 0.001; // Time in seconds
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.uniformMatrix4fv(uProjectionMatrix, false, projectionMatrix);

  // Update view matrix with camera rotation angles
  updateViewMatrix();      
  gl.uniformMatrix4fv(uModelViewMatrix, false, viewMatrix);
  
  const updatedViewMatrix = mat4.clone(viewMatrix);
  
  gl.uniformMatrix4fv(uModelViewMatrix, false, updatedViewMatrix);

  // Draw ground
  gl.bindBuffer(gl.ARRAY_BUFFER, ground.vboPosition);
  gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aPosition);

  gl.bindBuffer(gl.ARRAY_BUFFER, ground.vboNormal);
  gl.vertexAttribPointer(aNormal, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aNormal);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ground.index);

  const groundModelMatrix = mat4.create();
  mat4.translate(groundModelMatrix, groundModelMatrix, [-1, -5, -1]);
  mat4.scale(groundModelMatrix, groundModelMatrix, [4, 0.1, 3]);

  const groundModelViewMatrix = mat4.create();
  mat4.multiply(groundModelViewMatrix, updatedViewMatrix, groundModelMatrix);

  const groundNormalMatrix = mat3.create();
  mat3.normalFromMat4(groundNormalMatrix, groundModelViewMatrix);

  gl.uniformMatrix4fv(uModelViewMatrix, false, groundModelViewMatrix);
  gl.uniformMatrix3fv(uNormalMatrix, false, groundNormalMatrix);
  gl.uniform3fv(uColor, [0.3, 1.0, 0.3]);

  gl.drawElements(gl.TRIANGLES, ground.numElements, gl.UNSIGNED_SHORT, 0);

  // Draw sky moon
  gl.bindBuffer(gl.ARRAY_BUFFER, moon.vboPosition);
  gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aPosition);

  gl.bindBuffer(gl.ARRAY_BUFFER, moon.vboNormal);
  gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aNormal);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, moon.index);

  const moonModelMatrix = mat4.create();
  const moonModelViewMatrix = mat4.create();
  const moonNormalMatrix = mat3.create();
  
  mat3.normalFromMat4(moonNormalMatrix, moonModelViewMatrix);

  /// Moon revolution
  const moonRevolutionRadius = 8; // Revolution radius
  const moonRevolutionSpeed = 0.2; // Revolution speed

  // Update moon position and revolution
  mat4.identity(moonModelMatrix);
  updateModelMatrixWithRevolution(moonModelMatrix, time, moonRevolutionRadius, moonRevolutionSpeed);

  // Update light position
  const updatedLightPosition = getMoonPosition(moonModelMatrix);
  gl.uniform3fv(uLightPosition, updatedLightPosition);

  updatedLightPosition[1] += 5; // Add Y-offset to make the moon appear higher
  mat4.translate(moonModelMatrix, moonModelMatrix, updatedLightPosition);
  // Update moon model-view and normal matrices
  mat4.multiply(moonModelViewMatrix, updatedViewMatrix, moonModelMatrix);
  mat3.normalFromMat4(moonNormalMatrix, moonModelViewMatrix);

  // Update shader uniforms for the moon
  gl.uniformMatrix4fv(uModelViewMatrix, false, moonModelViewMatrix);
  gl.uniformMatrix3fv(uNormalMatrix, false, moonNormalMatrix);
  gl.uniform3fv(uColor, [0.827, 0.827, 0.827]); // light gray color

  gl.drawElements(gl.TRIANGLES, moon.numElements, gl.UNSIGNED_SHORT, 0);

  // Draw head
  const head1ModelMatrix = mat4.create();
  mat4.translate(head1ModelMatrix, head1ModelMatrix, headPosition);
  drawBodyPart(gl, head1ModelMatrix, updatedViewMatrix, head, [0.9, 0.6, 0.0]);

  // Draw torso
  const torsoModelMatrix = mat4.create();
  mat4.translate(torsoModelMatrix, torsoModelMatrix, torsoPosition);
  drawBodyPart(gl, torsoModelMatrix, updatedViewMatrix, torso, [0.0, 0.5, 1.0]);

  limbs.forEach((limbData) => {
    const limbModelMatrix = mat4.create();
    mat4.translate(limbModelMatrix, limbModelMatrix, limbData.position);
    mat4.rotateX(limbModelMatrix, limbModelMatrix, limbData.rotation);
    drawBodyPart(gl, limbModelMatrix, updatedViewMatrix, limb, [0.0, 0.5, 1.0]);
  });

  // Creating a combined model matrix for both the slide and the ladder
  const combinedModelMatrix = mat4.create();
  mat4.translate(combinedModelMatrix, combinedModelMatrix, [-5.0, -4.5, -5.0]);

  // Draw slide
  gl.bindBuffer(gl.ARRAY_BUFFER, slide.vboPosition);
  gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aPosition);

  gl.bindBuffer(gl.ARRAY_BUFFER, slide.vboNormal);
  gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aNormal);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, slide.index);

  const slideModelMatrix = mat4.create();
  mat4.copy(slideModelMatrix, combinedModelMatrix); // combined model matrix
  mat4.scale(slideModelMatrix, slideModelMatrix, [2.2, 1.7, 2]);
  mat4.rotateZ(slideModelMatrix, slideModelMatrix, Math.PI / 4);

  const slideModelViewMatrix = mat4.create();
  mat4.multiply(slideModelViewMatrix, updatedViewMatrix, slideModelMatrix);

  const slideNormalMatrix = mat3.create();
  mat3.normalFromMat4(slideNormalMatrix, slideModelViewMatrix);

  gl.uniformMatrix4fv(uModelViewMatrix, false, slideModelViewMatrix);
  gl.uniformMatrix3fv(uNormalMatrix, false, slideNormalMatrix);
  gl.uniform3fv(uColor, [0.8, 0.3, 0.3]);

  gl.drawElements(gl.TRIANGLES, slide.numElements, gl.UNSIGNED_SHORT, 0);

  // Define ladder/sticks position on the ground
  const ladderPositions = [
    [-8, 0, 0.9],
    [-8, 0, -0.9],
  ];    

  const ladderSticks = [
    [-8, 4.8, -1],
    [-8, 4.0, -1],
    [-8, 3.2, -1],
    [-8, 2.4, -1],
    [-8, 1.6, -1],
    [-8, 0.8, -1]
  ];
  
  ladderPositions.forEach((position) => {
    // Draw ladder
    gl.bindBuffer(gl.ARRAY_BUFFER, ladder.vboPosition);
    gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aPosition);
  
    gl.bindBuffer(gl.ARRAY_BUFFER, ladder.vboNormal);
    gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aNormal);
  
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ladder.index);

    const ladderModelMatrix = mat4.create();
    mat4.copy(ladderModelMatrix, combinedModelMatrix); // combined model matrix
    mat4.translate(ladderModelMatrix, ladderModelMatrix, position);
  
    const ladderModelViewMatrix = mat4.create();
    mat4.multiply(ladderModelViewMatrix, updatedViewMatrix, ladderModelMatrix);
  
    const ladderNormalMatrix = mat3.create();
    mat3.normalFromMat4(ladderNormalMatrix, ladderModelViewMatrix);
  
    gl.uniformMatrix4fv(uModelViewMatrix, false, ladderModelViewMatrix);
    gl.uniformMatrix3fv(uNormalMatrix, false, ladderNormalMatrix);
    gl.uniform3fv(uColor, [0.7, 0.7, 0.7]); // Set ladder color
  
    gl.drawElements(gl.TRIANGLES, ladder.numElements, gl.UNSIGNED_SHORT, 0);
  });

  ladderSticks.forEach((position) => {
    // Draw ladder
    gl.bindBuffer(gl.ARRAY_BUFFER, sticks.vboPosition);
    gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aPosition);
  
    gl.bindBuffer(gl.ARRAY_BUFFER, sticks.vboNormal);
    gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aNormal);
  
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sticks.index);

    const ladderModelMatrix = mat4.create();
    mat4.copy(ladderModelMatrix, combinedModelMatrix); // combined model matrix
    mat4.translate(ladderModelMatrix, ladderModelMatrix, position);
    mat4.rotateX(ladderModelMatrix, ladderModelMatrix, Math.PI/2);
  
    const ladderModelViewMatrix = mat4.create();
    mat4.multiply(ladderModelViewMatrix, updatedViewMatrix, ladderModelMatrix);
  
    const ladderNormalMatrix = mat3.create();
    mat3.normalFromMat4(ladderNormalMatrix, ladderModelViewMatrix);
  
    gl.uniformMatrix4fv(uModelViewMatrix, false, ladderModelViewMatrix);
    gl.uniformMatrix3fv(uNormalMatrix, false, ladderNormalMatrix);
    gl.uniform3fv(uColor, [0.7, 0.7, 0.7]); // Set ladder color
  
    gl.drawElements(gl.TRIANGLES, ladder.numElements, gl.UNSIGNED_SHORT, 0);
  });
  
  // Draw trunk of the tree
  gl.bindBuffer(gl.ARRAY_BUFFER, trunk.vboPosition);
  gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aPosition);

  gl.bindBuffer(gl.ARRAY_BUFFER, trunk.vboNormal);
  gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aNormal);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, trunk.index);

  // Tree model matrix
  const treeModelMatrix = mat4.create();
  mat4.translate(treeModelMatrix, treeModelMatrix, [5.0, 0.0, -10]);

  // Transform trunk of the tree
  const trunkModelMatrix = mat4.clone(treeModelMatrix);
  mat4.scale(trunkModelMatrix, trunkModelMatrix, [0.8, 5.5, 1.5]);
  mat4.rotateX(trunkModelMatrix, trunkModelMatrix, Math.PI);

  const trunkModelViewMatrix = mat4.create();
  mat4.multiply(trunkModelViewMatrix, updatedViewMatrix, trunkModelMatrix);

  const trunkNormalMatrix = mat3.create();
  mat3.normalFromMat4(trunkNormalMatrix, trunkModelViewMatrix);

  gl.uniformMatrix4fv(uModelViewMatrix, false, trunkModelViewMatrix);
  gl.uniformMatrix3fv(uNormalMatrix, false, trunkNormalMatrix);
  gl.uniform3fv(uColor, [0.8, 0.4, 0.2]);

  gl.drawElements(gl.TRIANGLES, trunk.numElements, gl.UNSIGNED_SHORT, 0);

  // Draw foliage
  gl.bindBuffer(gl.ARRAY_BUFFER, head.vboPosition);
  gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aPosition);

  gl.bindBuffer(gl.ARRAY_BUFFER, head.vboNormal);
  gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aNormal);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, head.index);

  // transform foliage
  const foliageModelMatrix = mat4.clone(treeModelMatrix);
  mat4.translate(foliageModelMatrix, foliageModelMatrix, [0, 0.0, 0]);
  mat4.scale(foliageModelMatrix, foliageModelMatrix, [2, 2, 3]);

  const foliageModelViewMatrix = mat4.create();
  mat4.multiply(foliageModelViewMatrix, updatedViewMatrix, foliageModelMatrix);

  const foliageNormalMatrix = mat3.create();
  mat3.normalFromMat4(foliageNormalMatrix, foliageModelViewMatrix);

  gl.uniformMatrix4fv(uModelViewMatrix, false, foliageModelViewMatrix);
  gl.uniformMatrix3fv(uNormalMatrix, false, foliageNormalMatrix);
  gl.uniform3fv(uColor, [0, 0.5, 0.0]);

  gl.drawElements(gl.TRIANGLES, head.numElements, gl.UNSIGNED_SHORT, 0);

  // Draw swing
  gl.bindBuffer(gl.ARRAY_BUFFER, swing.vboPosition);
  gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aPosition);

  gl.bindBuffer(gl.ARRAY_BUFFER, swing.vboNormal);
  gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aNormal);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, swing.index);

  const swingModelMatrix = mat4.create();
  mat4.translate(swingModelMatrix, swingModelMatrix, swingPosition);
  mat4.scale(swingModelMatrix, swingModelMatrix, [2.0, 2.0, 2.0]);
  mat4.rotateX(swingModelMatrix, swingModelMatrix, Math.PI / 2);

  const swingModelViewMatrix = mat4.create();
  mat4.multiply(swingModelViewMatrix, updatedViewMatrix, swingModelMatrix);

  const swingNormalMatrix = mat3.create();
  mat3.normalFromMat4(swingNormalMatrix, swingModelViewMatrix);

  gl.uniformMatrix4fv(uModelViewMatrix, false, swingModelViewMatrix);
  gl.uniformMatrix3fv(uNormalMatrix, false, swingNormalMatrix);
  gl.uniform3fv(uColor, [0.3, 0.3, 1.5]);

  gl.drawElements(gl.TRIANGLES, swing.numElements, gl.UNSIGNED_SHORT, 0);

  // Draw sitting bench
  gl.bindBuffer(gl.ARRAY_BUFFER, sittingBench.vboPosition);
  gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aPosition);

  gl.bindBuffer(gl.ARRAY_BUFFER, sittingBench.vboNormal);
  gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aNormal);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sittingBench.index);

  const sittingBenchModelMatrix = mat4.create();
  mat4.translate(sittingBenchModelMatrix, sittingBenchModelMatrix, [6, -3.5, 8]);
  mat4.scale(sittingBenchModelMatrix, sittingBenchModelMatrix, [4, 1, 1]);

  const sittingBenchModelViewMatrix = mat4.create();
  mat4.multiply(sittingBenchModelViewMatrix, updatedViewMatrix, sittingBenchModelMatrix);

  const sittingBenchNormalMatrix = mat3.create();
  mat3.normalFromMat4(sittingBenchNormalMatrix, sittingBenchModelViewMatrix);

  gl.uniformMatrix4fv(uModelViewMatrix, false, sittingBenchModelViewMatrix);
  gl.uniformMatrix3fv(uNormalMatrix, false, sittingBenchNormalMatrix);
  gl.uniform3fv(uColor, [0, 0.5, 0.8]);

  gl.drawElements(gl.TRIANGLES, sittingBench.numElements, gl.UNSIGNED_SHORT, 0);

  const lightPolePositions = [
    [-20, -2, -15], // Top-left corner
    [18, -2, -15], // Top-right corner
    [18, -2, 13], // Bottom-right corner
    [-20, -2, 13], // Bottom-left corner
  ];    

  lightPolePositions.forEach((position)=>{
  // Draw head
  gl.bindBuffer(gl.ARRAY_BUFFER, head.vboPosition);
  gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aPosition);

  gl.bindBuffer(gl.ARRAY_BUFFER, head.vboNormal);
  gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aNormal);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, head.index);

  // Light model matrix
  const lightModelMatrix = mat4.create();
  mat4.translate(lightModelMatrix, lightModelMatrix, position);

  const headModelMatrix = mat4.clone(lightModelMatrix);
  mat4.translate(headModelMatrix, headModelMatrix, [0, 2.5, 0]);

  const headModelViewMatrix = mat4.create();
  mat4.multiply(headModelViewMatrix, updatedViewMatrix, headModelMatrix);

  const headNormalMatrix = mat3.create();
  mat3.normalFromMat4(headNormalMatrix, headModelViewMatrix);

  gl.uniformMatrix4fv(uModelViewMatrix, false, headModelViewMatrix);
  gl.uniformMatrix3fv(uNormalMatrix, false, headNormalMatrix);

  // Get time-based color values
  const time = performance.now() * 0.001;
  const r = getColorValue(time);
  const g = getColorValue(time + 2 * Math.PI / 3);
  const b = getColorValue(time + 4 * Math.PI / 3);

  gl.uniform3fv(uColor, [r, g, b]);

  gl.drawElements(gl.TRIANGLES, head.numElements, gl.UNSIGNED_SHORT, 0);

  // Draw pole
  const poleModelMatrix = mat4.clone(lightModelMatrix);
  mat4.scale(poleModelMatrix, poleModelMatrix, poleScale);

  const poleModelViewMatrix = mat4.create();
  mat4.multiply(poleModelViewMatrix, updatedViewMatrix, poleModelMatrix);

  gl.uniformMatrix4fv(uModelViewMatrix, false, poleModelViewMatrix);

  const poleNormalMatrix = mat3.create();
  mat3.normalFromMat4(poleNormalMatrix, poleModelViewMatrix);
  gl.uniformMatrix3fv(uNormalMatrix, false, poleNormalMatrix);

  gl.bindBuffer(gl.ARRAY_BUFFER, pole.vboPosition);
  gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aPosition);

  gl.bindBuffer(gl.ARRAY_BUFFER, pole.vboNormal);
  gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aNormal);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, pole.index);
  gl.uniform3f(uColor, 0.1, 0.7, 0.3);
  gl.drawElements(gl.TRIANGLES, pole.numElements, gl.UNSIGNED_SHORT, 0);

  gl.disableVertexAttribArray(aPosition);
  gl.disableVertexAttribArray(aNormal);
  });
  
  requestAnimationFrame(render);
}
render();
