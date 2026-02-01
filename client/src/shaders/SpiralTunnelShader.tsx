import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float iTime;
  uniform vec2 iResolution;
  varying vec2 vUv;

  #define T (iTime * 2.0)

  vec3 P(float z) {
    return vec3(cos(z * 0.05) * 12.0, cos(z * 0.1) * 12.0, z);
  }

  mat2 rot(float a) {
    float c = cos(a), s = sin(a);
    return mat2(c, -s, s, c);
  }

  float smin(float a, float b, float k) {
    float f = max(0.0, 1.0 - abs(b - a) / k);
    return min(a, b) - k * 0.25 * f * f;
  }

  vec2 sminVec2(vec2 a, vec2 b, float k) {
    vec2 f = max(vec2(0.0), 1.0 - abs(b - a) / k);
    return min(a, b) - k * 0.25 * f * f;
  }

  float drawObject(vec3 p) {
    p = abs(cos(p));
    return dot(p, p);
  }

  float cellTile(vec3 p) {
    vec4 v, d;
    p *= 0.5;
    d.x = drawObject(p - vec3(0.4, 0.5, 0.6));
    p.xy = vec2(p.y - p.x, p.y + p.x);
    d.y = drawObject(p - vec3(0.6, 0.5, 0.4));
    p.yz = vec2(p.z - p.y, p.z + p.y);
    d.z = drawObject(p - vec3(0.2, 0.4, 0.5));
    p.xz = vec2(p.z - p.x, p.z + p.x);
    d.w = drawObject(p - vec3(0.3, 0.4, 0.6));

    v.xy = sminVec2(d.xz, d.yw, 0.05);
    d.x = smin(v.x, v.y, 0.05);

    return d.x;
  }

  float map(vec3 p) {
    vec3 q = P(p.z);

    float s = 4.0 -
      min(length(p.y - q.x - 3.0),
      min(length(p.xy - q.xy),
      length(p.xy - q.y + 4.0)));

    s = max(s, q.x + q.y);
    s -= cellTile(p);

    return s;
  }

  float AO(vec3 pos, vec3 nor) {
    float sca = 2.0, occ = 0.6;
    for(int i = 0; i < 5; i++) {
      float hr = 0.01 + float(i) * 0.5 / 4.0;
      float dd = map(nor * hr + pos);
      occ += (hr - dd) * sca;
      sca *= 0.7;
    }
    return clamp(1.0 - occ, 0.0, 1.0);
  }

  vec4 fog(vec4 rgba, float d) {
    float fogDistance = 4.0 + sin(T) * 0.5;
    float fogAmount = 0.04 + sin(T * 0.1) * 0.01;
    if(fogDistance != 0.0) {
      float f = d - fogDistance;
      if(f > 0.0) {
        f = min(1.0, f * fogAmount);
        rgba = mix(rgba, vec4(1.0, 2.0, 4.0, 0.0) * vec4(0.2 + f), f);
      }
    }
    return rgba;
  }

  void main() {
    vec2 uv = (vUv - 0.5) * 2.0;
    uv.x *= iResolution.x / iResolution.y;

    float s = 0.002, d = 0.0, i = 0.0;

    vec3 e = vec3(0.01, 0.0, 0.0);
    vec3 p = P(T);
    vec3 ro = p;
    vec3 Z = normalize(P(T + 4.0) - p);
    vec3 X = normalize(vec3(Z.z, 0.0, -Z.x));
    vec3 Y = cross(X, Z);

    mat2 rotMat = rot(sin(T * 0.2) * 0.3);
    vec2 rotUv = rotMat * uv;
    vec3 D = normalize(vec3(rotUv, 1.0));
    D = D.x * (-X) + D.y * Y + D.z * Z;

    vec4 o = vec4(0.0);

    for(float iter = 0.0; iter < 100.0; iter++) {
      i = iter;
      p = ro + D * d;
      s = map(p) * 0.5;
      d += s;
      o += (1.0 + cos(p.z + vec4(6.0, 2.0, 3.0, 4.0)));
    }

    // Normal calculation
    vec3 n = normalize(vec3(
      map(p - e.xyy) - map(p + e.xyy),
      map(p - e.yxy) - map(p + e.yxy),
      map(p - e.yyx) - map(p + e.yyx)
    ));

    // Procedural texture instead of iChannel0
    vec3 tex = vec3(0.5) + 0.5 * cos(p * 0.5 + vec3(0.0, 2.0, 4.0));

    o.rgb *= tex * 8.0;
    o.rgb -= abs(dot(sin(p.z * 0.4 + p * 4.0), vec3(0.5)));
    o.rgb -= abs(dot(sin(p.z * 0.4 + p * 16.0), vec3(0.5)));

    o.rgb *= AO(p, n) * 6.0;
    o.rgb *= max(dot(n, normalize(ro - p)), 0.01);

    o = tanh(fog(o / 300.0 / max(d, 4.0), d));

    gl_FragColor = vec4(o.rgb, 1.0);
  }
`;

export function SpiralTunnelShader() {
  const meshRef = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(() => ({
    iTime: { value: 0 },
    iResolution: { value: new THREE.Vector2(1920, 1080) }
  }), []);

  useFrame((state) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      material.uniforms.iTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <mesh ref={meshRef} scale={[-1, 1, 1]}>
      <sphereGeometry args={[50, 64, 32]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        side={THREE.BackSide}
      />
    </mesh>
  );
}
