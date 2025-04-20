//
// Initialize a Shader Program, which consists of a Vertex Shader and a Fragment Shader, compiled and linked.
//
function initShaderProgram(gl, vsSource, fsSource) {
  // Create and compile the two shaders.
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

  // Check if shader compilation failed
  if (!vertexShader || !fragmentShader) {
    console.error("Shader compilation failed. Cannot link program.");
    // Clean up shaders if one succeeded and the other failed
    if (vertexShader) gl.deleteShader(vertexShader);
    if (fragmentShader) gl.deleteShader(fragmentShader);
    return null;
  }

  // Combine the two shaders into a shader program
  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  // If creating the shader program failed, alert
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert(
      `Unable to initialize the shader program: ${gl.getProgramInfoLog(
        shaderProgram
      )}`
    );
    gl.deleteProgram(shaderProgram); // Clean up program
    gl.deleteShader(vertexShader);   // Clean up shaders
    gl.deleteShader(fragmentShader);
    return null;
  }

  gl.validateProgram(shaderProgram);
  if (!gl.getProgramParameter(shaderProgram, gl.VALIDATE_STATUS)) {
    console.error('ERROR validating program!', gl.getProgramInfoLog(shaderProgram));
    gl.deleteProgram(shaderProgram); // Clean up program
    gl.deleteShader(vertexShader);   // Clean up shaders
    gl.deleteShader(fragmentShader);
    return null; // Return null on validation failure too
  }

  gl.useProgram(shaderProgram);

  return shaderProgram;
}

//
// creates a shader of the given type with the given source code, and compiles it.
//
function loadShader(gl, type, source) {
  // Make an empty shader
  const shader = gl.createShader(type);

  // Send the source to the shader object
  gl.shaderSource(shader, source);

  // Compile the shader program
  gl.compileShader(shader);

  // If compiling the shader failed, log error
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const shaderType = type === gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT';
    console.error(
      `An error occurred compiling the ${shaderType} shader: ${gl.getShaderInfoLog(shader)}`
    );
    // Optionally log the source code that failed
    console.error(`Shader source:\n${source}`); 
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}



export { initShaderProgram };