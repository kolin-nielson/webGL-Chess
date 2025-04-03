precision mediump float;

uniform vec4 uPickColor; // Unique color for the object being drawn
 
void main() {
    // Output the solid picking color
    gl_FragColor = uPickColor;
} 