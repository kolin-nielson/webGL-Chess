attribute vec3 aVertexPosition;
uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix; // View matrix without translation
varying highp vec3 vTextureCoord;

void main() {
  // Use position directly as texture coordinate for cubemap
  vTextureCoord = aVertexPosition;
  // Convert to homogenous coordinates, apply view/projection
  vec4 pos = uProjectionMatrix * uViewMatrix * vec4(aVertexPosition, 1.0);
  // Ensure skybox is always drawn behind everything else (set z = w)
  gl_Position = pos.xyww;
} 