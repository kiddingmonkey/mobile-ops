import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

interface Props {
  criticals: number
  warnings: number
  running: number
  clusters: number
  okClusters: number
}

/**
 * 正前方弧形主屏幕
 * 显示星系图 + 实时告警/集群/任务数据
 */
export default function MainScreen({ criticals, warnings, running, clusters, okClusters }: Props) {
  const glowRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (glowRef.current) {
      const s = 1 + Math.sin(t * 0.8) * 0.02
      glowRef.current.scale.set(s, s, 1)
    }
  })

  const combat = criticals > 0
  const primaryColor = combat ? '#ff3b5c' : '#4fc3f7'

  // 弧形屏幕（正前方，Z 负方向）
  return (
    <group position={[0, 3.5, -8]}>
      {/* 屏幕背板（弧形近似：用 CylinderGeometry 局部片段） */}
      <mesh ref={glowRef}>
        <cylinderGeometry args={[8, 8, 4, 32, 1, true, -Math.PI / 4, Math.PI / 2]} />
        <meshBasicMaterial
          color={primaryColor}
          toneMapped={false}
          transparent
          opacity={0.08}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* 屏幕边框（发光） */}
      <mesh>
        <cylinderGeometry args={[8.05, 8.05, 4.1, 32, 1, true, -Math.PI / 4, Math.PI / 2]} />
        <meshBasicMaterial
          color={primaryColor}
          toneMapped={false}
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
          wireframe
        />
      </mesh>

      {/* HTML 内容层：星系数据面板 */}
      <Html
        position={[0, 0, 4]}
        transform
        occlude={false}
        distanceFactor={4}
        style={{
          width: 900,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        <div style={{
          padding: 20,
          background: 'linear-gradient(135deg, rgba(3,5,16,0.7) 0%, rgba(10,20,45,0.5) 100%)',
          border: `2px solid ${primaryColor}`,
          borderRadius: 6,
          fontFamily: "'JetBrains Mono', monospace",
          color: '#eaf4ff',
          textShadow: `0 0 12px ${primaryColor}`,
          boxShadow: `0 0 40px ${primaryColor}80, inset 0 0 40px rgba(79,195,247,0.15)`,
        }}>
          {/* 标题 */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            paddingBottom: 12,
            borderBottom: `1px solid ${primaryColor}60`,
          }}>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.3em', color: primaryColor }}>
              ◆ GALAXY OVERVIEW · 星系总览
            </div>
            <div style={{ fontSize: 13, color: primaryColor, letterSpacing: '0.2em' }}>
              {combat ? '⚠ RED ALERT' : warnings > 0 ? '△ CAUTION' : '● NOMINAL'}
            </div>
          </div>

          {/* 5 项汇总（大数字网格） */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
            <StatBlock label="CLUSTERS · 集群" value={clusters} color="#4fc3f7" />
            <StatBlock label="CRITICAL · 紧急" value={criticals} color="#ff3b5c" pulse={criticals > 0} />
            <StatBlock label="WARNING · 告警" value={warnings} color="#fbbf24" />
            <StatBlock label="OPS RUN · 任务" value={running} color="#a78bfa" />
            <StatBlock label="OK · 健康" value={`${okClusters}/${clusters}`} color="#4ade80" />
          </div>

          {/* 底部扫描线 */}
          <div style={{
            marginTop: 16,
            fontSize: 10,
            letterSpacing: '0.4em',
            color: `${primaryColor}80`,
            textAlign: 'center',
          }}>
            ▸ STARDECK · 全息舰桥指挥中心 · 实时监控 ◂
          </div>
        </div>
      </Html>
    </group>
  )
}

function StatBlock({ label, value, color, pulse }: { label: string; value: number | string; color: string; pulse?: boolean }) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '12px 8px',
      background: `${color}10`,
      border: `1px solid ${color}60`,
      borderRadius: 4,
      animation: pulse ? 'hd-breathe 0.8s ease-in-out infinite' : undefined,
    }}>
      <div style={{
        fontSize: 32,
        fontWeight: 700,
        color,
        textShadow: `0 0 16px ${color}`,
        lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{
        fontSize: 10,
        color: `${color}dd`,
        letterSpacing: '0.15em',
        marginTop: 6,
      }}>
        {label}
      </div>
    </div>
  )
}
