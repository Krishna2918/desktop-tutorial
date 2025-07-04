// Advanced Car Vertex Shader
// Neural Car Adventure - AAA Edition
// Supports advanced lighting, deformation, and quantum effects

#include "common.hlsl"

cbuffer PerFrame : register(b0)
{
    float4x4 ViewProjectionMatrix;
    float4x4 ViewMatrix;
    float4x4 ProjectionMatrix;
    float3 CameraPosition;
    float Time;
    float3 LightDirection;
    float LightIntensity;
    float4 QuantumEffects; // x: superposition, y: entanglement, z: uncertainty, w: coherence
}

cbuffer PerObject : register(b1)
{
    float4x4 WorldMatrix;
    float4x4 PreviousWorldMatrix;
    float4 MaterialProperties; // x: metallic, y: roughness, z: clearcoat, w: anisotropic
    float3 CarVelocity;
    float CarSpeed;
    float3 CarAngularVelocity;
    float WallClimbingIntensity;
    float4 EmotionalState; // x: excitement, y: frustration, z: focus, w: satisfaction
}

cbuffer GeneticProperties : register(b2)
{
    float SpeedGene;
    float HandlingGene;
    float GripGene;
    float EfficiencyGene;
    float WallClimbingGene;
    float AdaptabilityGene;
    float AestheticsGene;
    float Reserved;
}

struct VertexInput
{
    float3 Position : POSITION;
    float3 Normal : NORMAL;
    float3 Tangent : TANGENT;
    float2 UV : TEXCOORD0;
    float2 UV2 : TEXCOORD1;
    float4 Color : COLOR;
    uint VertexID : SV_VertexID;
};

struct VertexOutput
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

// Quantum effect functions
float3 ApplyQuantumSuperposition(float3 position, float intensity)
{
    float3 offset = float3(0, 0, 0);
    
    // Multiple quantum states create position uncertainty
    float wave1 = sin(Time * 2.0 + position.x * 0.1) * intensity;
    float wave2 = cos(Time * 1.5 + position.y * 0.15) * intensity;
    float wave3 = sin(Time * 3.0 + position.z * 0.05) * intensity;
    
    offset.x += wave1 * 0.02;
    offset.y += wave2 * 0.015;
    offset.z += wave3 * 0.01;
    
    return position + offset;
}

float3 ApplyQuantumEntanglement(float3 position, float3 velocity, float intensity)
{
    // Entangled particles influence each other
    float3 entangled_offset = float3(0, 0, 0);
    
    // Create entanglement patterns
    float entanglement_freq = 5.0 + intensity * 3.0;
    float phase = Time * entanglement_freq;
    
    entangled_offset.x = sin(phase + position.y * 0.1) * intensity * 0.005;
    entangled_offset.y = cos(phase + position.z * 0.1) * intensity * 0.005;
    entangled_offset.z = sin(phase + position.x * 0.1) * intensity * 0.005;
    
    return position + entangled_offset;
}

// Genetic modification functions
float3 ApplyGeneticDeformation(float3 position, float3 normal)
{
    float3 deformed_pos = position;
    
    // Speed gene affects aerodynamics
    if (SpeedGene > 1.1)
    {
        // Make car more streamlined
        float streamline_factor = (SpeedGene - 1.0) * 0.1;
        deformed_pos.x *= (1.0 + streamline_factor);
        deformed_pos.y *= (1.0 - streamline_factor * 0.3);
    }
    
    // Grip gene affects wheel wells and stance
    if (GripGene > 1.1)
    {
        float stance_factor = (GripGene - 1.0) * 0.05;
        deformed_pos.y -= stance_factor; // Lower stance
    }
    
    // Wall climbing gene adds special modifications
    if (WallClimbingGene > 1.1)
    {
        float climb_factor = (WallClimbingGene - 1.0) * 0.1;
        // Add aggressive body kit elements
        if (abs(normal.y) < 0.5) // Side surfaces
        {
            deformed_pos += normal * climb_factor * 0.02;
        }
    }
    
    return deformed_pos;
}

// Emotional influence functions
float3 ApplyEmotionalDeformation(float3 position, float4 emotion)
{
    float3 emotional_offset = float3(0, 0, 0);
    
    // Excitement makes car appear more dynamic
    if (emotion.x > 0.3) // Excitement
    {
        float excitement_wave = sin(Time * 8.0 + position.x * 0.2) * emotion.x;
        emotional_offset.y += excitement_wave * 0.001;
    }
    
    // Frustration creates tension
    if (emotion.y > 0.3) // Frustration
    {
        float tension = emotion.y * 0.002;
        emotional_offset += normalize(position) * tension * sin(Time * 15.0);
    }
    
    // Focus creates precision
    if (emotion.z > 0.3) // Focus
    {
        // Reduce random motion when focused
        emotional_offset *= (1.0 - emotion.z * 0.5);
    }
    
    return position + emotional_offset;
}

// Wind and aerodynamic effects
float3 ApplyAerodynamicDeformation(float3 position, float3 velocity, float speed)
{
    float3 aero_offset = float3(0, 0, 0);
    
    // High speed creates compression effects
    if (speed > 0.3)
    {
        float compression = speed * 0.01;
        aero_offset.x -= compression * sin(Time * 2.0 + position.y * 0.1);
    }
    
    // Turbulence effects
    float turbulence = speed * 0.005;
    aero_offset.y += sin(Time * 10.0 + position.x * 0.3) * turbulence;
    aero_offset.z += cos(Time * 8.0 + position.y * 0.2) * turbulence;
    
    return position + aero_offset;
}

// Wall climbing effects
float3 ApplyWallClimbingDeformation(float3 position, float intensity)
{
    float3 climb_offset = float3(0, 0, 0);
    
    if (intensity > 0.1)
    {
        // Create grip tension effects
        float grip_tension = intensity * 0.003;
        climb_offset += normalize(position) * grip_tension * sin(Time * 20.0);
        
        // Add climbing particle attachment points
        float attachment_effect = sin(Time * 5.0 + position.x * 0.5) * intensity * 0.001;
        climb_offset.y += attachment_effect;
    }
    
    return position + climb_offset;
}

VertexOutput main(VertexInput input)
{
    VertexOutput output;
    
    // Start with base position
    float3 worldPos = input.Position;
    
    // Apply genetic modifications
    worldPos = ApplyGeneticDeformation(worldPos, input.Normal);
    
    // Apply emotional influences
    worldPos = ApplyEmotionalDeformation(worldPos, EmotionalState);
    
    // Apply aerodynamic effects
    float speedNormalized = saturate(CarSpeed / 100.0); // Normalize to 0-1
    worldPos = ApplyAerodynamicDeformation(worldPos, CarVelocity, speedNormalized);
    
    // Apply wall climbing effects
    worldPos = ApplyWallClimbingDeformation(worldPos, WallClimbingIntensity);
    
    // Apply quantum effects
    worldPos = ApplyQuantumSuperposition(worldPos, QuantumEffects.x);
    worldPos = ApplyQuantumEntanglement(worldPos, CarVelocity, QuantumEffects.y);
    
    // Transform to world space
    float4 worldPosition = mul(float4(worldPos, 1.0), WorldMatrix);
    float4 previousWorldPosition = mul(float4(input.Position, 1.0), PreviousWorldMatrix);
    
    // Calculate motion vectors for temporal effects
    float4 currentScreenPos = mul(worldPosition, ViewProjectionMatrix);
    float4 previousScreenPos = mul(previousWorldPosition, ViewProjectionMatrix);
    
    // Output calculations
    output.Position = currentScreenPos;
    output.WorldPosition = worldPosition;
    output.PreviousPosition = previousScreenPos;
    
    // Transform normals and tangents
    output.Normal = normalize(mul(input.Normal, (float3x3)WorldMatrix));
    output.Tangent = normalize(mul(input.Tangent, (float3x3)WorldMatrix));
    output.Bitangent = cross(output.Normal, output.Tangent);
    
    // UV coordinates
    output.UV = input.UV;
    output.UV2 = input.UV2;
    output.Color = input.Color;
    
    // View and light directions
    output.ViewDirection = normalize(CameraPosition - worldPosition.xyz);
    output.LightDirection = -LightDirection;
    
    // Quantum data for pixel shader
    output.QuantumData = QuantumEffects;
    
    // Motion vector for temporal anti-aliasing
    output.MotionVector = currentScreenPos - previousScreenPos;
    
    // Material properties
    output.MaterialData = MaterialProperties;
    
    // Car-specific data
    output.CarSpeedNormalized = speedNormalized;
    output.WallContactIntensity = WallClimbingIntensity;
    output.EmotionalInfluence = EmotionalState.xyz;
    
    // Vertex index for advanced effects
    output.VertexIndex = input.VertexID;
    
    return output;
}