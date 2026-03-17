export type Module = 'file' | 'npm' | 'oci' | 'maven' | 'pypi' | 'go' | 'alpine'

export interface User {
  id: number
  created_at: string
  updated_at: string
  username: string
  email: string
  is_admin: boolean
  status: number
  upload_modules: Module[]
}

export const ALL_MODULES: Module[] = ['file', 'npm', 'oci', 'maven', 'pypi', 'go', 'alpine']

export interface FileEntry {
  id: number
  created_at: string
  updated_at: string
  path: string
  size: number
  mime_type: string
  sha256: string
  uploader_id: number
  uploader: string
}

export interface NpmPackage {
  name: string
  description: string
  dist_tags: Record<string, string>
  version_count: number
  cached_count: number
}

export interface NpmVersion {
  version: string
  tarball_name: string
  size: number
  shasum: string
  cached: boolean
  uploader: string
  created_at: string
}

export interface LoginResponse {
  code: number
  message: string
  data: {
    token: string
    user: User
  }
}

export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

export interface PageData<T> {
  items: T[]
  total: number
  page: number
}

export interface GoCacheStats {
  cache_dir: string
  size_bytes: number
  file_count: number
  upstream: string
  goprivate: string
}

export interface OciRepository {
  id: number
  name: string
  upstream: string
  tag_count: number
  cached_blob_count: number
  total_size: number
  updated_at: string
  is_pushed: boolean
  pushed_by: string
  pushed_by_id: number
}

export interface OciTagInfo {
  tag: string
  manifest_digest: string
  media_type: string
  size: number
  created_at: string
}

export interface OciCacheStats {
  repo_count: number
  tag_count: number
  blob_count: number
  size_bytes: number
  upstream: string
}

export interface MavenRepository {
  id: number
  name: string
  upstream: string
  enabled: boolean
  description: string
  storage_path: string
}

export interface MavenArtifact {
  id: number
  created_at: string
  updated_at: string
  group_id: string
  artifact_id: string
  version: string
  is_snapshot: boolean
  is_uploaded: boolean
  uploader_id: number
  uploader: string
  files?: MavenArtifactFile[]
}

export interface MavenArtifactFile {
  id: number
  created_at: string
  filename: string
  path: string
  size: number
  checksum: string
  classifier: string
  extension: string
  cached: boolean
  is_uploaded: boolean
}

export interface MavenRepositoryConfig {
  name: string
  url: string
  enabled: boolean
  priority: number
  is_private: boolean
  username?: string
  password?: string
}

export interface PyPIPackage {
  id: number
  created_at: string
  updated_at: string
  name: string
  summary: string
  home_page: string
  license: string
  author: string
  author_email: string
  repository_id: number
  is_uploaded: boolean
  uploader_id: number
  uploader: string
  versions?: PyPIVersion[]
}

export interface PyPIVersion {
  id: number
  created_at: string
  updated_at: string
  package_id: number
  version: string
  requires_python: string
  release_url: string
  yanked: boolean
  files?: PyPIFile[]
}

export interface PyPIFile {
  id: number
  created_at: string
  updated_at: string
  version_id: number
  filename: string
  path: string
  size: number
  md5: string
  sha256: string
  packagetype: string
  python_version: string
  platform: string
  upload_time: string
  upload_time_formatted: string
  cached: boolean
  is_uploaded: boolean
}

// Alpine APK Types
export interface AlpinePackage {
  Name: string
  Version: string
  Architecture: string
  Description: string
  URL: string
  License: string
  Maintainer: string
  Size: number
  InstalledSize: number
  Checksum: string
  Origin: string
  BuildTime: string
  Commit: string
  IsCached: boolean
  CachePath: string
  CacheTime: string
}

export interface AlpineCacheStats {
  TotalIndexes: number
  TotalPackages: number
  CachedPackages: number
  CacheSize: number
}
