precision mediump float;
uniform samplerCube uSkyboxSampler;
varying highp vec3 vTextureCoord;
 
void main() {
  // Sample the cubemap using the varying coordinate
  gl_FragColor = textureCube(uSkyboxSampler, normalize(vTextureCoord));
} 