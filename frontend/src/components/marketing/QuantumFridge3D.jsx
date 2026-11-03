import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  Environment,
  PerformanceMonitor,
} from '@react-three/drei';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import * as THREE from 'three';
import {
  FRIDGE_STAGES,
  STAGE_RADIUS,
  clamp01,
  stageWorldY,
} from './quantum-fridge-model.js';

const COPPER = new THREE.Color('#c87555');
const GOLD = new THREE.Color('#d4a855');
const STEEL = new THREE.Color('#9aa3ab');

function plateMaterial(tint, emissive = 0) {
  return new THREE.MeshPhysicalMaterial({
    color: tint,
    metalness: 1,
    roughness: 0.16,
    clearcoat: 0.72,
    clearcoatRoughness: 0.1,
    envMapIntensity: 1.55,
    emissive: new THREE.Color('#22d3ee'),
    emissiveIntensity: emissive,
  });
}

const GLASS_CAP = new THREE.MeshPhysicalMaterial({
  color: '#e8f4ff',
  metalness: 0,
  roughness: 0.04,
  transmission: 0.82,
  thickness: 0.35,
  ior: 1.48,
  transparent: true,
  opacity: 0.55,
  depthWrite: false,
});

function StagePlate({ index, progress, hoveredIndex }) {
  const group = useRef(null);
  const rim = useRef(null);
  const mat = useMemo(
    () => plateMaterial(index === 0 ? COPPER : GOLD, 0),
    [index],
  );

  useFrame(({ clock }) => {
    const p = progress.current;
    const y = stageWorldY(p, index);
    if (group.current) {
      group.current.position.y = y;
      const lift = hoveredIndex.current === index ? 0.08 : 0;
      group.current.position.y += lift;
    }
    const glow = hoveredIndex.current === index ? 0.35 : 0;
    mat.emissiveIntensity = glow;
    if (rim.current) {
      rim.current.rotation.y = clock.elapsedTime * 0.08;
    }
  });

  const r = STAGE_RADIUS[index];
  const h = index === 0 ? 0.12 : 0.07;

  return (
    <group ref={group}>
      <mesh castShadow receiveShadow material={mat}>
        <cylinderGeometry args={[r, r * 0.98, h, 64, 1, false]} />
      </mesh>
      <mesh ref={rim} position={[0, h / 2 + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[r * 0.78, r * 0.94, 64]} />
        <meshPhysicalMaterial
          color="#f0d8b0"
          metalness={0.85}
          roughness={0.18}
          clearcoat={0.9}
          transparent
          opacity={0.92}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, h / 2 + 0.006, 0]} material={GLASS_CAP}>
        <cylinderGeometry args={[r * 0.9, r * 0.9, 0.012, 64]} />
      </mesh>
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return (
          <mesh
            key={`bolt-${i}`}
            position={[Math.cos(a) * r * 0.86, h / 2 + 0.01, Math.sin(a) * r * 0.86]}
          >
            <sphereGeometry args={[0.018, 8, 8]} />
            <meshStandardMaterial color="#f0d4a8" metalness={1} roughness={0.35} />
          </mesh>
        );
      })}
    </group>
  );
}

function SupportRods({ progress }) {
  const rods = useRef([]);
  const xs = [-0.55, -0.28, 0, 0.28, 0.55, 0.82].map((x) => x * 0.9);

  useFrame(() => {
    const p = progress.current;
    const top = stageWorldY(p, 0) + 0.06;
    const bottom = stageWorldY(p, FRIDGE_STAGES.length - 1) - 0.2;
    rods.current.forEach((line) => {
      if (!line) return;
      const mid = (top + bottom) / 2;
      line.position.set(line.userData.x, mid, line.userData.z);
      line.scale.set(1, Math.max(0.01, top - bottom), 1);
    });
  });

  return (
    <group>
      {xs.map((x, i) => (
        <mesh
          key={`rod-${i}`}
          ref={(node) => {
            rods.current[i] = node;
            if (node) {
              node.userData.x = x;
              node.userData.z = x * 0.35;
            }
          }}
          position={[x, 0, x * 0.35]}
        >
          <cylinderGeometry args={[0.014, 0.014, 1, 8]} />
          <meshStandardMaterial color={STEEL} metalness={1} roughness={0.28} />
        </mesh>
      ))}
    </group>
  );
}

function CoaxCables({ progress }) {
  const group = useRef(null);
  const curves = useMemo(() => {
    return Array.from({ length: 52 }, (_, i) => {
      const lane = (i % 14) - 6.5;
      const bank = Math.floor(i / 12);
      return { lane, bank, seed: i * 0.17 };
    });
  }, []);

  const tubeGeo = useMemo(() => new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(), new THREE.Vector3(0, 1, 0)), 2, 0.004, 6, false), []);

  useFrame(() => {
    if (!group.current) return;
    const p = progress.current;
    const ys = FRIDGE_STAGES.map((_, i) => stageWorldY(p, i) + 0.04);
    group.current.children.forEach((mesh, i) => {
      const { lane, bank, seed } = curves[i];
      const points = ys.map((y, stageIndex) => {
        const bow = Math.sin(stageIndex * 1.2 + seed) * 0.06;
        return new THREE.Vector3(lane * 0.07 + bow, y, lane * 0.04 + bank * 0.02);
      });
      const curve = new THREE.CatmullRomCurve3(points);
      const geo = new THREE.TubeGeometry(curve, 28, 0.0028 + (bank % 3) * 0.0008, 5, false);
      mesh.geometry.dispose();
      mesh.geometry = geo;
    });
  });

  return (
    <group ref={group}>
      {curves.map((c) => (
        <mesh key={c.seed} geometry={tubeGeo} castShadow>
          <meshStandardMaterial
            color={c.bank % 2 ? '#c9a227' : '#b8c4cc'}
            metalness={0.85}
            roughness={0.38}
          />
        </mesh>
      ))}
    </group>
  );
}

function TopFlange({ progress }) {
  const group = useRef(null);
  useFrame(() => {
    const y = stageWorldY(progress.current, 0);
    if (group.current) group.current.position.y = y + 0.08;
  });
  return (
    <group ref={group}>
      <mesh>
        <cylinderGeometry args={[1.12, 1.12, 0.06, 64]} />
        <meshPhysicalMaterial color="#8b4518" metalness={1} roughness={0.3} envMapIntensity={1.2} />
      </mesh>
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 1.02, 0.04, Math.sin(a) * 1.02]}>
            <cylinderGeometry args={[0.012, 0.012, 0.05, 6]} />
            <meshStandardMaterial color="#d4a574" metalness={1} roughness={0.35} />
          </mesh>
        );
      })}
    </group>
  );
}

function Attenuators({ progress }) {
  const group = useRef(null);
  useFrame(() => {
    if (group.current) group.current.position.y = stageWorldY(progress.current, 3) + 0.02;
  });
  return (
    <group ref={group}>
      {Array.from({ length: 14 }, (_, i) => (
        <mesh key={i} position={[(i - 6.5) * 0.065, 0, ((i % 4) - 1.5) * 0.04]}>
          <boxGeometry args={[0.028, 0.05, 0.02]} />
          <meshStandardMaterial color="#c9a227" metalness={0.9} roughness={0.35} />
        </mesh>
      ))}
    </group>
  );
}

function ThermalPosts({ progress }) {
  const posts = useRef([]);
  const anchors = [
    [0.35, 0.35],
    [-0.35, 0.35],
    [0.35, -0.35],
    [-0.35, -0.35],
  ];

  useFrame(() => {
    const p = progress.current;
    const ys = FRIDGE_STAGES.map((_, i) => stageWorldY(p, i));
    posts.current.forEach((mesh, i) => {
      if (!mesh) return;
      const [x, z] = anchors[i];
      const mid = (ys[0] + ys.at(-1)) / 2;
      const h = Math.max(0.05, ys[0] - ys.at(-1));
      mesh.position.set(x, mid, z);
      mesh.scale.set(1, h, 1);
    });
  });

  return (
    <group>
      {anchors.map(([x, z], i) => (
        <mesh key={i} ref={(n) => { posts.current[i] = n; }} position={[x, 0, z]}>
          <cylinderGeometry args={[0.008, 0.008, 1, 6]} />
          <meshStandardMaterial color="#7a848c" metalness={0.95} roughness={0.32} />
        </mesh>
      ))}
    </group>
  );
}

function VacuumGlass() {
  return (
    <mesh position={[0, 0.55, 0]}>
      <cylinderGeometry args={[1.22, 0.48, 3.1, 64, 1, true]} />
      <meshPhysicalMaterial
        color="#c8e8f5"
        metalness={0.02}
        roughness={0.02}
        transmission={0.55}
        thickness={0.8}
        ior={1.46}
        transparent
        opacity={0.22}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

function ShieldAndQpu({ progress }) {
  const shell = useRef(null);
  const qpu = useRef(null);
  const qpuMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#0a1a20',
        metalness: 0.6,
        roughness: 0.35,
        emissive: '#22d3ee',
        emissiveIntensity: 0.15,
      }),
    [],
  );

  useFrame(() => {
    const p = progress.current;
    const y = stageWorldY(p, FRIDGE_STAGES.length - 1) - 0.38;
    if (shell.current) shell.current.position.y = y;
    const glow = clamp01((p - 0.82) / 0.14);
    qpuMat.emissiveIntensity = 0.12 + glow * 1.4;
  });

  return (
    <group ref={shell}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.42, 0.44, 0.55, 48, 1, true]} />
        <meshPhysicalMaterial
          color={STEEL}
          metalness={0.95}
          roughness={0.22}
          transparent
          opacity={0.88}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh ref={qpu} position={[0, -0.05, 0]} material={qpuMat}>
        <boxGeometry args={[0.22, 0.04, 0.22]} />
      </mesh>
      <mesh position={[0, -0.02, 0]}>
        <octahedronGeometry args={[0.06, 0]} />
        <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0.8} metalness={0.4} />
      </mesh>
    </group>
  );
}

function Chandelier({ progress, hoveredIndex, reduced, variant }) {
  const rig = useRef(null);

  useFrame(({ clock }, delta) => {
    const p = progress.current;
    if (!rig.current) return;
    if (variant === 'auth' && !reduced) {
      rig.current.rotation.y = Math.sin(clock.elapsedTime * 0.22) * 0.14;
      return;
    }
    if (p < 0.12 && !reduced) {
      rig.current.rotation.y = Math.sin(clock.elapsedTime * 0.35) * 0.12;
    } else {
      rig.current.rotation.y = THREE.MathUtils.damp(rig.current.rotation.y, 0, 3, delta);
    }
  });

  return (
    <group ref={rig} scale={1.08}>
      <VacuumGlass />
      <TopFlange progress={progress} />
      <ThermalPosts progress={progress} />
      <SupportRods progress={progress} />
      <CoaxCables progress={progress} />
      <Attenuators progress={progress} />
      {FRIDGE_STAGES.map((_, index) => (
        <StagePlate key={FRIDGE_STAGES[index].id} index={index} progress={progress} hoveredIndex={hoveredIndex} />
      ))}
      <ShieldAndQpu progress={progress} />
    </group>
  );
}

function CameraRig({ progress, reduced, variant }) {
  useFrame(({ camera }, delta) => {
    const p = progress.current;
    if (variant === 'auth') {
      camera.position.x = THREE.MathUtils.damp(camera.position.x, 0.45, 3.5, delta);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, 0.72 - p * 0.55, 3.5, delta);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, 5.15, 3.5, delta);
      camera.lookAt(0, 0.05 - p * 0.35, 0);
      return;
    }
    const targetY = 0.9 - p * 1.6;
    const targetX = reduced ? 0 : Math.sin(p * Math.PI) * 1.35;
    const targetZ = 5.4 - p * 0.35;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, targetX, 4, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, targetY, 4, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, 4, delta);
    camera.lookAt(0, 0.2 - p * 0.85, 0);
  });
  return null;
}

function Scene({ progress, hoveredIndex, reduced, onPerfDecline, variant }) {
  const auth = variant === 'auth';
  return (
    <>
      {!auth ? <PerformanceMonitor onDecline={onPerfDecline} flipflops={3} ms={1000} /> : null}
      <Environment files="/hdr/studio.hdr" background={false} />
      <ambientLight intensity={auth ? 0.34 : 0.28} />
      <directionalLight position={[4, 6, 3]} intensity={auth ? 1.65 : 1.5} />
      <directionalLight position={[-3, 2, -2]} intensity={0.6} color="#88ccff" />
      <pointLight position={[0, 1.8, 2]} intensity={auth ? 0.45 : 0.2} color="#ffffff" />
      <pointLight position={[0, -1.2, 1.5]} intensity={0.4} color="#22d3ee" />
      <Chandelier progress={progress} hoveredIndex={hoveredIndex} reduced={reduced} variant={variant} />
      <CameraRig progress={progress} reduced={reduced} variant={variant} />
      <EffectComposer multisampling={0}>
        <Bloom
          luminanceThreshold={auth ? 0.82 : 0.72}
          luminanceSmoothing={0.35}
          intensity={auth ? 0.35 : 0.55}
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
}

export default function QuantumFridge3D({
  progress,
  hoveredIndex,
  reduced,
  active,
  onPerfDecline,
  variant = 'scroll',
}) {
  const auth = variant === 'auth';
  return (
    <Canvas
      dpr={auth ? [1, 1.25] : [1, 1.5]}
      camera={{ fov: auth ? 30 : 28, position: auth ? [0.45, 0.72, 5.15] : [0, 0.85, 5.4], near: 0.1, far: 40 }}
      gl={{
        alpha: true,
        antialias: false,
        powerPreference: 'default',
        failIfMajorPerformanceCaveat: false,
      }}
      frameloop={active ? 'always' : 'never'}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.18;
        gl.setClearColor(0x000000, 0);
      }}
      style={{ width: '100%', height: '100%', touchAction: auth ? 'auto' : 'pan-y' }}
    >
      <Scene
        progress={progress}
        hoveredIndex={hoveredIndex}
        reduced={reduced}
        onPerfDecline={onPerfDecline}
        variant={variant}
      />
    </Canvas>
  );
}
