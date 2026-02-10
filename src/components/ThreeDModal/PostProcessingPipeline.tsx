import { useEffect, useMemo, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { EffectComposer, RenderPass, ShaderPass, FXAAShader, UnrealBloomPass } from 'three-stdlib';
import { Vector2, Vector3 } from 'three';

interface PostProcessingPipelineProps {
  enabled?: boolean;
  bloomIntensity?: number;
  bloomThreshold?: number;
  bloomRadius?: number;
  fxaaEnabled?: boolean;
}

const PostProcessingPipeline = ({
  enabled = true,
  bloomIntensity = 0.4,
  bloomThreshold = 0.2,
  bloomRadius = 0.3,
  fxaaEnabled = true
}: PostProcessingPipelineProps) => {
  const composerRef = useRef<EffectComposer | null>(null);
  const { gl, scene, camera, size } = useThree();

  // Create the post-processing composer
  const composer = useMemo(() => {
    if (!enabled) return null;

    const comp = new EffectComposer(gl);
    comp.setSize(size.width, size.height);
    comp.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Add render pass
    const renderPass = new RenderPass(scene, camera);
    comp.addPass(renderPass);

    // Add bloom pass for glow effects
    const bloomPass = new UnrealBloomPass(
      new Vector2(size.width, size.height),
      bloomIntensity,
      bloomRadius,
      bloomThreshold
    );
    comp.addPass(bloomPass);

    // Add FXAA for anti-aliasing
    if (fxaaEnabled) {
      const fxaaPass = new ShaderPass(FXAAShader);
      fxaaPass.material.uniforms['resolution'].value.set(
        1 / (size.width * Math.min(window.devicePixelRatio, 2)),
        1 / (size.height * Math.min(window.devicePixelRatio, 2))
      );
      comp.addPass(fxaaPass);
    }

    return comp;
  }, [enabled, gl, scene, camera, size, bloomIntensity, bloomRadius, bloomThreshold, fxaaEnabled]);

  composerRef.current = composer;

  // Handle resize events
  useEffect(() => {
    if (!composer) return;

    const handleResize = () => {
      composer.setSize(size.width, size.height);
      composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      // Update FXAA resolution if enabled
      const fxaaPass = composer.passes.find(pass => pass instanceof ShaderPass && (pass as any).name === 'FXAAShader');
      if (fxaaPass && fxaaEnabled) {
        (fxaaPass as ShaderPass).material.uniforms['resolution'].value.set(
          1 / (size.width * Math.min(window.devicePixelRatio, 2)),
          1 / (size.height * Math.min(window.devicePixelRatio, 2))
        );
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      composer.dispose();
    };
  }, [composer, size, fxaaEnabled]);

  // Render loop
  useFrame(() => {
    if (composer && enabled) {
      composer.render();
    }
  }, 1); // Lower priority than main render

  // Return null since we're handling rendering manually
  return null;
};

export default PostProcessingPipeline;