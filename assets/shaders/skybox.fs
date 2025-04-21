precision mediump float;
uniform samplerCube uSkyboxSampler;
varying highp vec3 vTextureCoord;
 
void main() {
  
  gl_FragColor = textureCube(uSkyboxSampler, normalize(vTextureCoord));
} 