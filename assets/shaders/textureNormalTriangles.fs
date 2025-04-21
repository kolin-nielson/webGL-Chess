precision mediump float;


varying highp vec3 vFragPosition; 
varying highp vec2 vTextureCoord;

varying highp vec3 vNormal;       


uniform sampler2D uTexture;
uniform highp vec3 uEyePosition;    


uniform highp vec3 uLightDirection1;
uniform vec3 uDiffuseColor1;
uniform vec3 uSpecularColor1;


uniform highp vec3 uLightDirection2;
uniform vec3 uDiffuseColor2;
uniform vec3 uSpecularColor2;


uniform vec3 uAmbientColor;
uniform float uShininess;
uniform float uEnvIntensity; 




uniform int uSelectedId; 
uniform int uActuallySelectedId; 


uniform int uUseTexture;        
uniform vec4 uBaseColor;        


vec3 calculateDirectionalLight(vec3 lightDir, vec3 diffuseColor, vec3 specularColor, vec3 normal, vec3 viewDir, float shininess, vec3 textureRgb) {
    
    float diff = max(dot(normal, -lightDir), 0.0);
    vec3 diffuseContribution = diffuseColor * textureRgb * diff;

    
    vec3 specularContribution = vec3(0.0);
    if (diff > 0.0) { 
        vec3 reflectDir = reflect(lightDir, normal);
        float spec = pow(max(dot(viewDir, reflectDir), 0.0), shininess);
        specularContribution = specularColor * spec;
    }

    return diffuseContribution + specularContribution;
}

void main() {
    vec4 finalColor;

    if (uUseTexture == 1) {
        
        vec4 textureColor = texture2D(uTexture, vTextureCoord);
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(uEyePosition - vFragPosition); 

        
        bool isSelected = (uSelectedId > 0 && uSelectedId == uActuallySelectedId);
        float highlightFactor = isSelected ? 1.2 : 1.0; 

        
        vec3 ambient = uAmbientColor * textureColor.rgb * (isSelected ? 1.5 : 1.0);

        
        vec3 light1Dir = normalize(uLightDirection1);
        vec3 light1Contribution = calculateDirectionalLight(light1Dir, uDiffuseColor1, uSpecularColor1, normal, viewDir, uShininess, textureColor.rgb);

        
        vec3 light2Dir = normalize(uLightDirection2);
        vec3 light2Contribution = calculateDirectionalLight(light2Dir, uDiffuseColor2, uSpecularColor2, normal, viewDir, uShininess, textureColor.rgb);

        
        vec3 litColor = ambient + (light1Contribution + light2Contribution) * highlightFactor;

        
        if (isSelected) {
             litColor = mix(litColor, vec3(0.9, 0.9, 0.5), 0.2); 
             litColor = mix(litColor, vec3(0.9, 0.9, 0.3), 0.4); 
        }

        
        vec3 reflectDir = reflect(-viewDir, normal);
        
        vec3 envColor = vec3(
            mix(0.2, 0.8, reflectDir.y * 0.5 + 0.5),
            mix(0.3, 0.9, reflectDir.y * 0.5 + 0.5),
            1.0
        );
        vec3 blendedColor = mix(litColor, envColor, uEnvIntensity);
        finalColor = vec4(clamp(blendedColor, 0.0, 1.0), textureColor.a);

    } else {
        
        finalColor = uBaseColor;
    }

    gl_FragColor = finalColor;
}
