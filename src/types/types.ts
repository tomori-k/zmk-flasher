export interface Device {
  id: string
  name: string
  side?: 'left' | 'right'
  pid: string
  vid: string
  manufacturer?: string
  product?: string
  serial?: string
}

export interface Repository {
  url: string
  workflowId?: number
}

export interface Firmware {
  id: string
  name: string
  path: string
  buildDate: string
  branch: string
  commitMessage?: string
  boardId?: string
  familyId?: string
  size: number
}

export interface Workflow {
  id: number
  name: string
  path: string
  state: string
  created_at: string
  updated_at: string
  url: string
  html_url: string
  badge_url: string
}
