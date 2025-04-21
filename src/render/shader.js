


function initShaderProgram(gl, vsSource, fsSource) {
  
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

  
  if (!vertexShader || !fragmentShader) {
    console.error("Shader compilation failed. Cannot link program.");
    
    if (vertexShader) gl.deleteShader(vertexShader);
    if (fragmentShader) gl.deleteShader(fragmentShader);
    return null;
  }

  
  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert(
      `Unable to initialize the shader program: ${gl.getProgramInfoLog(
        shaderProgram
      )}`
    );
    gl.deleteProgram(shaderProgram); 
    gl.deleteShader(vertexShader);   
    gl.deleteShader(fragmentShader);
    return null;
  }

  gl.validateProgram(shaderProgram);
  if (!gl.getProgramParameter(shaderProgram, gl.VALIDATE_STATUS)) {
    console.error('ERROR validating program!', gl.getProgramInfoLog(shaderProgram));
    gl.deleteProgram(shaderProgram); 
    gl.deleteShader(vertexShader);   
    gl.deleteShader(fragmentShader);
    return null; 
  }

  gl.useProgram(shaderProgram);

  return shaderProgram;
}




function loadShader(gl, type, source) {
  
  const shader = gl.createShader(type);

  
  gl.shaderSource(shader, source);

  
  gl.compileShader(shader);

  
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const shaderType = type === gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT';
    console.error(
      `An error occurred compiling the ${shaderType} shader: ${gl.getShaderInfoLog(shader)}`
    );
    
    console.error(`Shader source:\n${source}`); 
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}



export { initShaderProgram };