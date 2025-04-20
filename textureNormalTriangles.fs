precision mediump float;

// Passed from vertex shader
varying highp vec3 vFragPosition; // View-space fragment position
varying highp vec2 vTextureCoord;

varying highp vec3 vNormal;       // View-space normal

// Uniforms from main.js
uniform sampler2D uTexture;
uniform highp vec3 uEyePosition;    // View-space eye position

// Light 1 (Key)
uniform highp vec3 uLightDirection1;
uniform vec3 uDiffuseColor1;
uniform vec3 uSpecularColor1;

// Light 2 (Fill)
uniform highp vec3 uLightDirection2;
uniform vec3 uDiffuseColor2;
uniform vec3 uSpecularColor2;

// Shared Ambient
uniform vec3 uAmbientColor;
uniform float uShininess;
uniform float uEnvIntensity; // Intensity of environment reflection

// Uniform for selection highlighting
// Note: In WebGL 1, varying integers are not supported, so we use a uniform.
// The ChessSet draw method sets this for each piece before drawing it.
uniform int uSelectedId; // ID of the piece being drawn (set per piece)
uniform int uActuallySelectedId; // The ID of the piece currently selected by the user (set once per frame)

// Control flags/values
uniform int uUseTexture;        // Flag: 1 to use texture, 0 to use baseColor
uniform vec4 uBaseColor;        // Base color (used for highlights if uUseTexture is 0)

// Function to calculate directional light contribution
vec3 calculateDirectionalLight(vec3 lightDir, vec3 diffuseColor, vec3 specularColor, vec3 normal, vec3 viewDir, float shininess, vec3 textureRgb) {
    // Diffuse
    float diff = max(dot(normal, -lightDir), 0.0);
    vec3 diffuseContribution = diffuseColor * textureRgb * diff;

    // Specular
    vec3 specularContribution = vec3(0.0);
    if (diff > 0.0) { // Only calculate specular if light hits the surface
        vec3 reflectDir = reflect(lightDir, normal);
        float spec = pow(max(dot(viewDir, reflectDir), 0.0), shininess);
        specularContribution = specularColor * spec;
    }

    return diffuseContribution + specularContribution;
}

void main() {
    vec4 finalColor;

    if (uUseTexture == 1) {
        // --- Standard Textured Phong Lighting (Pieces/Board) ---
        vec4 textureColor = texture2D(uTexture, vTextureCoord);
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(uEyePosition - vFragPosition); // Shared for both lights

        // Selection Highlight adjustment
        bool isSelected = (uSelectedId > 0 && uSelectedId == uActuallySelectedId);
        float highlightFactor = isSelected ? 1.2 : 1.0; // General brightness boost if selected

        // Ambient (shared, slightly boosted if selected)
        vec3 ambient = uAmbientColor * textureColor.rgb * (isSelected ? 1.5 : 1.0);

        // Light 1 (Key Light)
        vec3 light1Dir = normalize(uLightDirection1);
        vec3 light1Contribution = calculateDirectionalLight(light1Dir, uDiffuseColor1, uSpecularColor1, normal, viewDir, uShininess, textureColor.rgb);

        // Light 2 (Fill Light)
        vec3 light2Dir = normalize(uLightDirection2);
        vec3 light2Contribution = calculateDirectionalLight(light2Dir, uDiffuseColor2, uSpecularColor2, normal, viewDir, uShininess, textureColor.rgb);

        // Combine Lighting
        vec3 litColor = ambient + (light1Contribution + light2Contribution) * highlightFactor;

        // Optional tint for selected piece
        if (isSelected) {
             litColor = mix(litColor, vec3(0.9, 0.9, 0.5), 0.2); // Mix with yellow
             litColor = mix(litColor, vec3(0.9, 0.9, 0.3), 0.4); // Mix more strongly with yellow/gold
        }

        // Environment reflection based on view and normal direction
        vec3 reflectDir = reflect(-viewDir, normal);
        // Simple gradient environment mapping: blue sky at top, warmer horizon
        vec3 envColor = vec3(
            mix(0.2, 0.8, reflectDir.y * 0.5 + 0.5),
            mix(0.3, 0.9, reflectDir.y * 0.5 + 0.5),
            1.0
        );
        vec3 blendedColor = mix(litColor, envColor, uEnvIntensity);
        finalColor = vec4(clamp(blendedColor, 0.0, 1.0), textureColor.a);

    } else {
        // --- Use Base Color (Highlights) ---
        finalColor = uBaseColor;
    }

    gl_FragColor = finalColor;
}
