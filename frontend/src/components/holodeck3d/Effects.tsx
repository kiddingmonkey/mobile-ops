import { EffectComposer, Bloom, ChromaticAberration, Scanline, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { Vector2 } from 'three'

/**
 * 后处理特效：Bloom 发光 + 色差 + 扫描线 + 暗角
 * lowPerf=true 时只保留 Bloom（低端手机）
 */
export default function Effects({ lowPerf = false }: { lowPerf?: boolean }) {
  if (lowPerf) {
    return (
      <EffectComposer>
        <Bloom
          intensity={0.8}
          luminanceThreshold={0.15}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
      </EffectComposer>
    )
  }

  return (
    <EffectComposer>
      <Bloom
        intensity={1.2}
        luminanceThreshold={0.1}
        luminanceSmoothing={0.9}
        mipmapBlur
      />
      <ChromaticAberration
        offset={new Vector2(0.0008, 0.0008)}
        radialModulation={false}
        modulationOffset={0}
        blendFunction={BlendFunction.NORMAL}
      />
      <Scanline density={2.5} opacity={0.04} blendFunction={BlendFunction.OVERLAY} />
      <Vignette eskil={false} offset={0.2} darkness={0.7} />
    </EffectComposer>
  )
}
