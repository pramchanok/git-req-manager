export interface Settings {
  gitlabUrl: string
  accessToken: string
  refreshIntervalMinutes: number
  projectIds: number[]
  webhookEnabled: boolean
  webhookPort: number
  webhookSecret: string
  webhookPublicUrl: string
  webhookUseTunnel: boolean
  launchAtStartup: boolean
  notifyOwnerGroupIds: number[]
  notifyOnMyMRMerged: boolean
}

export interface MRLabel {
  name: string
  color: string
  textColor: string
}

export interface MergeRequest {
  id: number
  iid: number
  projectId: number
  projectName: string
  projectNamespace: string
  title: string
  description: string
  state: 'opened' | 'closed' | 'locked' | 'merged'
  createdAt: string
  updatedAt: string
  mergedAt: string | null
  author: GitLabUser
  assignees: GitLabUser[]
  reviewers: GitLabUser[]
  sourceBranch: string
  targetBranch: string
  webUrl: string
  approvalsRequired: number
  approvalsLeft: number
  draft: boolean
  hasConflicts: boolean
  upvotes: number
  downvotes: number
  userNotesCount: number
  pipelineStatus: 'running' | 'success' | 'failed' | 'canceled' | null
  labels: MRLabel[]
}

export interface MRDiff {
  diff: string
  newPath: string
  oldPath: string
  aMode: string
  bMode: string
  newFile: boolean
  renamedFile: boolean
  deletedFile: boolean
}

export interface MRNote {
  id: number
  body: string
  author: GitLabUser
  createdAt: string
  updatedAt: string
  system: boolean
  resolvable: boolean
  resolved: boolean
  type: string | null
}

export interface MRDiscussion {
  id: string
  replyId: string
  notes: MRNote[]
}

export interface GitLabUser {
  id: number
  name: string
  username: string
  avatarUrl: string
  webUrl: string
  isAdmin?: boolean
}

export interface GitLabGroup {
  id: number
  name: string
  fullPath: string
  webUrl: string
}

export interface GitLabProject {
  id: number
  name: string
  nameWithNamespace: string
  webUrl: string
  defaultBranch: string
}

export type MRTab = 'myReviews' | 'allOpen'

export interface AppState {
  myReviewMRs: MergeRequest[]
  allOpenMRs: MergeRequest[]
  lastSyncedAt: string | null
  isSyncing: boolean
  error: string | null
  currentUser: GitLabUser | null
  isConfigured: boolean
  ownerGroups: GitLabGroup[]
}

export type UpdateStatus =
  | 'idle'
  | 'disabled'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'not-available'
  | 'error'

export interface UpdateState {
  currentVersion: string
  status: UpdateStatus
  availableVersion: string | null
  downloadedVersion: string | null
  progressPercent: number | null
  message: string | null
  releaseDate: string | null
  releaseNotes: string | null
}

export type IpcChannel =
  | 'get-settings'
  | 'save-settings'
  | 'get-app-state'
  | 'trigger-sync'
  | 'open-url'
  | 'app-state-updated'
  | 'sync-error'
  | 'tunnel-status'
  | 'check-cloudflared'
  | 'get-update-state'
  | 'check-for-updates'
  | 'install-update'
  | 'update-state-changed'
  | 'get-gitlab-groups'
  | 'get-group-members'
  | 'get-team-report-group'
  | 'set-team-report-group'
  | 'get-changelog'
  | 'set-last-seen-version'
  | 'show-changelog'
  | 'get-owner-groups'
  | 'get-mr-diffs'
  | 'get-mr-discussions'
  | 'add-mr-note'
  | 'approve-mr'
  | 'unapprove-mr'
  | 'merge-mr'
  | 'close-mr'
