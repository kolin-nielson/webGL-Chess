precision mediump float;

attribute vec3 aVertexPosition; // Input vertex position

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;

void main() {
    // Just calculate the final clip-space position
    gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aVertexPosition, 1.0);
} 