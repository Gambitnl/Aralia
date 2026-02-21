import type { RoadmapNode } from './types';

export type FeatureCategory = NonNullable<RoadmapNode['featureCategory']>;

export type ProcessingDocument = {
  sourcePath: string;
  featureGroup: string;
  feature: string;
  subFeatures?: Array<{
    name: string;
    state: 'done' | 'active' | 'planned' | 'unknown';
    canonicalPath?: string;
    level?: number;
    parent?: string;
  }>;
  status?: string;
  canonicalPath?: string;
  processedAt?: string;
};

export type FeatureBucket = {
  id: string;
  featureGroup: string;
  feature: string;
  featureCategory: FeatureCategory;
  docs: ProcessingDocument[];
};
