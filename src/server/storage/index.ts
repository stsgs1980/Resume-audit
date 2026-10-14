export {
  FileNotFoundError,
  InvalidJsonError,
  PathTraversalError,
  SchemaValidationError,
  WorkspaceExistsError,
} from "./errors";
export { fileExists, readJson, writeJsonAtomic } from "./files";
export { canonicalize, hashFacts, hashMeta } from "./hash";
export { canLock, readLockState, writeLockState } from "./lock";
export type { LockCheck, LockState } from "./lock";
export {
  createStorageConfig,
  ensureWithinRoot,
  getAuditPath,
  getClaimsPath,
  getEvidenceDir,
  getEvidencePath,
  getFactsPath,
  getLockPath,
  getResumePath,
  getResumesDir,
  getStageStatePath,
  getValidationPath,
  getWorkspaceDir,
  isValidSlug,
} from "./paths";
export type { StorageConfig } from "./paths";
export { invalidateAllDocuments, markDocumentStale, readStageState, writeStageState } from "./stage-state";
export { createWorkspace, deleteWorkspace, listWorkspaces, pathExists, workspaceExists } from "./workspaces";
