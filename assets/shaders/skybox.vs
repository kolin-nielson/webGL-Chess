attribute vec3 aVertexPosition;
uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix; 
varying highp vec3 vTextureCoord;

void main() {
  
  vTextureCoord = aVertexPosition;
  
  vec4 pos = uProjectionMatrix * uViewMatrix * vec4(aVertexPosition, 1.0);
  
  gl_Position = pos.xyww;
} 