export interface TPackagePublishState {
  _id: string,
  name: string,
  description: string,
  'dist-tags': Record<string, string>,
  versions: Record<string, TPackageVersionState>,
  readme: string,
  access: string,
  maintainers: TPackageMaintainerState[],
  _attachments: Record<string, TPackageStreamState>,
  time?: {
    modified: string,
    created: string,
    [key: string]: string,
  },
  publish_time?: number,
}

export interface TPackageVersionState {
  name: string,
  version: string,
  description: string,
  homepage?: string,
  license?: string,
  keywords?: string[],
  dependencies?: Record<string, string>,
  readme?: string,
  readmeFilename?: string,
  _id: string,
  _nodeVersion: string,
  _npmVersion: string,
  _npmUser: TPackageMaintainerState,
  maintainers: TPackageMaintainerState[],
  dist: {
    integrity: string,
    shasum: string,
    tarball: string,
  },
  deprecated?: string,
}

export interface TPackageMaintainerState {
  name: string,
  email: string,
}

export interface TPackageStreamState {
  content_type: string,
  data: string,
  length: number,
}