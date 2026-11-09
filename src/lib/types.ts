// UI shapes for validated catalog output. Runtime rules remain in metadata.schema.json.
export interface Asset {
  file: string;
  label: string;
  path: string;
  variant: 'icon' | 'wordmark' | 'logo';
  status: 'current' | 'historical';
  display?: 'primary' | 'alternative';
  background: 'light' | 'dark' | 'any';
  language: string;
  layout: string;
  color: string;
  source: string;
  sourcePage: string;
  sha256: string;
  bytes: number;
  width?: number;
  height?: number;
  qualityNotes?: string[];
  usageWarnings?: string[];
  provenance: {
    sourceType: string;
    processing: string;
    channel?: 'brand-library' | 'repository' | 'website' | 'app-store' | 'commons';
    placement?: 'header' | 'footer';
    pageTitle?: string;
  };
  rights: {
    status: string;
    license: string;
    reference: string;
    attribution: string;
    reviewedAt: string;
    notes?: string;
  };
}
export interface Artwork {
  id: string;
  label: string;
  files: string[];
  defaultAsset: string;
}
export interface ArtworkGroup {
  id: string;
  label: string;
  assets: Asset[];
  defaultAsset: Asset;
}
export interface Brand {
  id: string;
  name: string;
  aliases: string[];
  website: string;
  entityType: 'company' | 'product' | 'organization';
  categories: string[];
  parentId?: string;
  defaultAsset: string;
  assets: Asset[];
  artworks?: Artwork[];
  identity: {
    nameZh: string | null;
    nameEn: string | null;
    legalNames: {
      name: string;
      language: string;
      role: string;
      source: string;
      reviewedAt: string;
    }[];
    sources: { label: string; url: string; reviewedAt: string }[];
  };
}
export interface Catalog {
  schemaVersion: number;
  brands: Brand[];
}
