// Advanced Car Pixel Shader
// Neural Car Adventure - AAA Edition  
// Photorealistic PBR rendering with quantum effects

#include "common.hlsl"
#include "lighting.hlsl"
#include "quantum_effects.hlsl"

// Material textures
Texture2D AlbedoTexture : register(t0);
Texture2D NormalTexture : register(t1);
Texture2D RoughnessTexture : register(t2);
Texture2D MetallicTexture : register(t3);
Texture2D AOTexture : register(t4);
Texture2D ClearcoatTexture : register(t5);
Texture2D EmissionTexture : register(t6);
Texture2D DetailNormalTexture : register(t7);
Texture2D DetailRoughnessTexture : register(t8);
Texture2D DirtMaskTexture : register(t9);
Texture2D ScratchTexture : register(t10);
Texture2D QuantumNoiseTexture : register(t11);

// Environment textures
TextureCube EnvironmentTexture : register(t12);
TextureCube IrradianceTexture : register(t13);
Texture2D BRDFLutTexture : register(t14);
Texture2D ShadowMapTexture : register(t15);

// Quantum effect textures
Texture2D QuantumFieldTexture : register(t16);
Texture2D QuantumParticleTexture : register(t17);
Texture2D EntanglementTexture : register(t18);

SamplerState LinearSampler : register(s0);
SamplerState AnisotropicSampler : register(s1);
SamplerState ShadowSampler : register(s2);
SamplerState QuantumSampler : register(s3);

cbuffer MaterialProperties : register(b3)
{
    float4 BaseColor;
    float Metallic;
    float Roughness;
    float Clearcoat;
    float ClearcoatRoughness;
    float Anisotropy;
    float Subsurface;
    float Specular;
    float SpecularTint;
    float Sheen;
    float SheenTint;
    float Transmission;
    float IOR;
    float EmissionStrength;
    float4 EmissionColor;
    float DetailNormalStrength;
    float DetailRoughnessStrength;
}

cbuffer QuantumProperties : register(b4)
{
    float QuantumCoherence;
    float SuperpositionStrength;
    float EntanglementLevel;
    float UncertaintyRadius;
    float WaveFunctionPhase;
    float QuantumTunneling;
    float ParticleWaveDuality;
    float QuantumFieldStrength;
    float4 QuantumColors[4];
    float QuantumFluctuationRate;
    float QuantumEmissionIntensity;
    float QuantumDistortionAmount;
    float Reserved;
}

cbuffer LightingEnvironment : register(b5)
{
    float4 LightColors[8];
    float4 LightDirections[8];
    float4 LightPositions[8];
    float4 LightParameters[8]; // x: intensity, y: range, z: type, w: shadows
    int ActiveLightCount;
    float ShadowBias;
    float ShadowNormalBias;
    float AmbientIntensity;
    float4 AmbientColor;
    float IBLStrength;
    float SSRStrength;
    float GlobalIlluminationStrength;
    float VolumetricStrength;
}

struct PixelInput
{
    float4 Position : SV_POSITION;
    float4 WorldPosition : WORLD_POSITION;
    float4 PreviousPosition : PREV_POSITION;
    float3 Normal : NORMAL;
    float3 Tangent : TANGENT;
    float3 Bitangent : BITANGENT;
    float2 UV : TEXCOORD0;
    float2 UV2 : TEXCOORD1;
    float4 Color : COLOR;
    float3 ViewDirection : VIEW_DIR;
    float3 LightDirection : LIGHT_DIR;
    float4 QuantumData : QUANTUM_DATA;
    float4 MotionVector : MOTION_VECTOR;
    float4 MaterialData : MATERIAL_DATA;
    float CarSpeedNormalized : CAR_SPEED;
    float WallContactIntensity : WALL_CONTACT;
    float3 EmotionalInfluence : EMOTIONAL;
    nointerpolation uint VertexIndex : VERTEX_ID;
};

struct PixelOutput
{
    float4 Color : SV_TARGET0;          // Final color
    float4 Normal : SV_TARGET1;         // World space normal
    float4 MaterialProps : SV_TARGET2;  // Metallic, Roughness, AO, Specular
    float4 MotionVector : SV_TARGET3;   // Motion vectors
    float4 Emission : SV_TARGET4;       // Emission + quantum effects
    float4 QuantumState : SV_TARGET5;   // Quantum visualization data
};

// Advanced PBR functions
float3 GetDetailNormal(float2 uv, float3 normal, float3 tangent, float3 bitangent)
{
    float3 detailNormal = NormalTexture.Sample(LinearSampler, uv).xyz * 2.0 - 1.0;
    float3 detailNormal2 = DetailNormalTexture.Sample(LinearSampler, uv * 8.0).xyz * 2.0 - 1.0;
    
    // Blend detail normals
    detailNormal = lerp(detailNormal, detailNormal2, DetailNormalStrength);
    
    // Transform to world space
    float3x3 TBN = float3x3(tangent, bitangent, normal);
    return normalize(mul(detailNormal, TBN));
}

float3 CalculateQuantumGlow(float2 uv, float3 worldPos, float4 quantumData)
{
    float3 quantumGlow = float3(0, 0, 0);
    
    // Sample quantum field texture
    float2 quantumUV = uv + Time * 0.1;
    float quantumField = QuantumFieldTexture.Sample(QuantumSampler, quantumUV).r;
    
    // Superposition effect
    if (quantumData.x > 0.01)
    {
        float superpositionWave = sin(Time * 5.0 + worldPos.x * 0.1) * 0.5 + 0.5;
        quantumGlow += QuantumColors[0].rgb * superpositionWave * quantumData.x;
    }
    
    // Entanglement effect
    if (quantumData.y > 0.01)
    {
        float entanglementPattern = EntanglementTexture.Sample(QuantumSampler, uv + Time * 0.05).r;
        quantumGlow += QuantumColors[1].rgb * entanglementPattern * quantumData.y;
    }
    
    // Uncertainty principle visualization
    if (quantumData.z > 0.01)
    {
        float uncertainty = QuantumNoiseTexture.Sample(QuantumSampler, uv * 20.0 + Time * 0.2).r;
        quantumGlow += QuantumColors[2].rgb * uncertainty * quantumData.z;
    }
    
    // Quantum coherence
    if (quantumData.w > 0.01)
    {
        float coherenceWave = cos(Time * 3.0 + worldPos.y * 0.15) * 0.5 + 0.5;
        quantumGlow += QuantumColors[3].rgb * coherenceWave * quantumData.w;
    }
    
    return quantumGlow * QuantumEmissionIntensity;
}

float3 CalculateWallClimbingEffects(float2 uv, float intensity)
{
    float3 climbingGlow = float3(0, 0, 0);
    
    if (intensity > 0.1)
    {
        // Create sparking effect
        float sparkNoise = QuantumNoiseTexture.Sample(QuantumSampler, uv * 50.0 + Time * 2.0).r;
        if (sparkNoise > 0.8)
        {
            climbingGlow = float3(1.0, 0.8, 0.3) * (sparkNoise - 0.8) * 5.0 * intensity;
        }
        
        // Add grip pattern glow
        float gripPattern = sin(uv.x * 100.0) * sin(uv.y * 100.0);
        climbingGlow += float3(0.3, 0.6, 1.0) * gripPattern * intensity * 0.2;
    }
    
    return climbingGlow;
}

float3 CalculateEmotionalEffects(float3 baseColor, float3 emotional)
{
    float3 emotionalColor = baseColor;
    
    // Excitement makes colors more vibrant
    if (emotional.x > 0.3)
    {
        emotionalColor = lerp(emotionalColor, emotionalColor * 1.3, emotional.x * 0.3);
    }
    
    // Frustration adds red tint
    if (emotional.y > 0.3)
    {
        emotionalColor = lerp(emotionalColor, emotionalColor * float3(1.2, 0.9, 0.9), emotional.y * 0.2);
    }
    
    // Focus creates precision (less noise)
    if (emotional.z > 0.3)
    {
        // Reduce random variations when focused
        float focusMultiplier = 1.0 - emotional.z * 0.1;
        emotionalColor *= focusMultiplier;
    }
    
    return emotionalColor;
}

float CalculateSpeedEffects(float speed)
{
    float speedGlow = 0.0;
    
    if (speed > 0.5)
    {
        // High speed creates heat glow
        speedGlow = (speed - 0.5) * 2.0;
    }
    
    return speedGlow;
}

float3 CalculateAdvancedPBR(float3 albedo, float metallic, float roughness, float3 normal, 
                           float3 viewDir, float3 lightDir, float3 lightColor, float lightIntensity)
{
    float3 halfVector = normalize(viewDir + lightDir);
    float NdotL = saturate(dot(normal, lightDir));
    float NdotV = saturate(dot(normal, viewDir));
    float NdotH = saturate(dot(normal, halfVector));
    float VdotH = saturate(dot(viewDir, halfVector));
    
    // Fresnel
    float3 F0 = lerp(float3(0.04, 0.04, 0.04), albedo, metallic);
    float3 F = F0 + (1.0 - F0) * pow(1.0 - VdotH, 5.0);
    
    // Distribution
    float roughness2 = roughness * roughness;
    float roughness4 = roughness2 * roughness2;
    float denom = NdotH * NdotH * (roughness4 - 1.0) + 1.0;
    float D = roughness4 / (3.14159 * denom * denom);
    
    // Geometry
    float k = (roughness + 1.0) * (roughness + 1.0) / 8.0;
    float G1L = NdotL / (NdotL * (1.0 - k) + k);
    float G1V = NdotV / (NdotV * (1.0 - k) + k);
    float G = G1L * G1V;
    
    // BRDF
    float3 numerator = D * G * F;
    float denominator = 4.0 * NdotV * NdotL + 0.001;
    float3 specular = numerator / denominator;
    
    // Diffuse
    float3 kS = F;
    float3 kD = float3(1.0, 1.0, 1.0) - kS;
    kD *= 1.0 - metallic;
    
    float3 diffuse = kD * albedo / 3.14159;
    
    return (diffuse + specular) * lightColor * lightIntensity * NdotL;
}

float3 CalculateClearcoat(float3 normal, float3 viewDir, float3 lightDir, float clearcoat, float clearcoatRoughness)
{
    if (clearcoat < 0.01) return float3(0, 0, 0);
    
    float3 halfVector = normalize(viewDir + lightDir);
    float NdotH = saturate(dot(normal, halfVector));
    float VdotH = saturate(dot(viewDir, halfVector));
    
    // Clearcoat specular
    float clearcoatRoughness2 = clearcoatRoughness * clearcoatRoughness;
    float clearcoatRoughness4 = clearcoatRoughness2 * clearcoatRoughness2;
    float denom = NdotH * NdotH * (clearcoatRoughness4 - 1.0) + 1.0;
    float D = clearcoatRoughness4 / (3.14159 * denom * denom);
    
    float F = 0.04 + (1.0 - 0.04) * pow(1.0 - VdotH, 5.0);
    
    return float3(1, 1, 1) * D * F * clearcoat;
}

PixelOutput main(PixelInput input)
{
    PixelOutput output;
    
    // Sample base textures
    float4 albedoSample = AlbedoTexture.Sample(AnisotropicSampler, input.UV);
    float3 baseAlbedo = albedoSample.rgb * BaseColor.rgb * input.Color.rgb;
    float alpha = albedoSample.a * BaseColor.a * input.Color.a;
    
    // Sample material properties
    float metallic = MetallicTexture.Sample(LinearSampler, input.UV).r * Metallic;
    float roughness = RoughnessTexture.Sample(LinearSampler, input.UV).r * Roughness;
    float ao = AOTexture.Sample(LinearSampler, input.UV).r;
    float clearcoat = ClearcoatTexture.Sample(LinearSampler, input.UV).r * Clearcoat;
    
    // Calculate detailed normal
    float3 normal = GetDetailNormal(input.UV, input.Normal, input.Tangent, input.Bitangent);
    
    // Apply emotional effects to base color
    float3 emotionalAlbedo = CalculateEmotionalEffects(baseAlbedo, input.EmotionalInfluence);
    
    // Calculate quantum effects
    float3 quantumGlow = CalculateQuantumGlow(input.UV, input.WorldPosition.xyz, input.QuantumData);
    
    // Calculate wall climbing effects
    float3 climbingGlow = CalculateWallClimbingEffects(input.UV, input.WallContactIntensity);
    
    // Calculate speed effects
    float speedGlow = CalculateSpeedEffects(input.CarSpeedNormalized);
    
    // Advanced PBR lighting calculation
    float3 finalColor = float3(0, 0, 0);
    
    // Main directional light
    float3 pbrColor = CalculateAdvancedPBR(emotionalAlbedo, metallic, roughness, normal, 
                                          input.ViewDirection, input.LightDirection, 
                                          float3(1, 1, 1), 1.0);
    finalColor += pbrColor;
    
    // Clearcoat layer
    float3 clearcoatColor = CalculateClearcoat(normal, input.ViewDirection, input.LightDirection, 
                                              clearcoat, ClearcoatRoughness);
    finalColor += clearcoatColor;
    
    // Environment lighting (IBL)
    float3 reflectionVector = reflect(-input.ViewDirection, normal);
    float3 envColor = EnvironmentTexture.SampleLevel(LinearSampler, reflectionVector, roughness * 8.0).rgb;
    float3 irradiance = IrradianceTexture.Sample(LinearSampler, normal).rgb;
    
    float3 F0 = lerp(float3(0.04, 0.04, 0.04), emotionalAlbedo, metallic);
    float NdotV = saturate(dot(normal, input.ViewDirection));
    float3 F = F0 + (1.0 - F0) * pow(1.0 - NdotV, 5.0);
    
    float3 kS = F;
    float3 kD = float3(1.0, 1.0, 1.0) - kS;
    kD *= 1.0 - metallic;
    
    float3 diffuseIBL = kD * emotionalAlbedo * irradiance;
    float3 specularIBL = envColor * F;
    
    finalColor += (diffuseIBL + specularIBL) * IBLStrength * ao;
    
    // Add quantum effects
    finalColor += quantumGlow;
    
    // Add wall climbing effects
    finalColor += climbingGlow;
    
    // Add speed effects
    finalColor += float3(1.0, 0.5, 0.2) * speedGlow * 0.1;
    
    // Emission
    float3 emission = EmissionTexture.Sample(LinearSampler, input.UV).rgb * EmissionColor.rgb * EmissionStrength;
    finalColor += emission;
    
    // Quantum distortion effect
    if (input.QuantumData.z > 0.01)
    {
        float2 distortedUV = input.UV + sin(Time * 10.0 + input.WorldPosition.xy * 0.1) * input.QuantumData.z * 0.01;
        float3 distortedColor = AlbedoTexture.Sample(LinearSampler, distortedUV).rgb;
        finalColor = lerp(finalColor, distortedColor, input.QuantumData.z * 0.3);
    }
    
    // Output to G-Buffer
    output.Color = float4(finalColor, alpha);
    output.Normal = float4(normal * 0.5 + 0.5, 1.0);
    output.MaterialProps = float4(metallic, roughness, ao, clearcoat);
    output.MotionVector = input.MotionVector;
    output.Emission = float4(emission + quantumGlow + climbingGlow, speedGlow);
    output.QuantumState = float4(input.QuantumData.xyz, QuantumCoherence);
    
    return output;
}