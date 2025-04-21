precision mediump float;

attribute vec3 aVertexPosition;
attribute vec2 aTextureCoord;
attribute vec3 aVertexNormal;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform mat3 uNormalMatrix;
varying highp vec3 vFragPosition;
varying highp vec2 vTextureCoord;
varying highp vec3 vNormal;

void main() {
    vTextureCoord = aTextureCoord;

    vec4 viewPosition = uModelViewMatrix * vec4(aVertexPosition, 1.0);
    vFragPosition = viewPosition.xyz;

    vNormal = normalize(uNormalMatrix * aVertexNormal);

    gl_Position = uProjectionMatrix * viewPosition;
}
