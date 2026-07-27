interface PostProcessingPipelineProps {
    enabled?: boolean;
    bloomIntensity?: number;
    bloomThreshold?: number;
    bloomRadius?: number;
    fxaaEnabled?: boolean;
}
declare const PostProcessingPipeline: ({ enabled, bloomIntensity, bloomThreshold, bloomRadius, fxaaEnabled }: PostProcessingPipelineProps) => any;
export default PostProcessingPipeline;
