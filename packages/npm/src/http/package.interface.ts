import { TPackageVersionState } from './version';
import { TPackageMaintainerState } from './maintainer';
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

export interface TPackageStreamState {
  content_type: string,
  data: string,
  length: number,
}

export interface TPackageStarState { 
  _id: string, 
  _rev: string, 
  users: Record<string, true> 
}