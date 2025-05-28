export interface Device {
  id: string
  name: string
  side?: 'left' | 'right'
  pid: string
  vid: string
}

export interface Repository {
  id: string
  url: string
  owner: string
  repo: string
}

export interface Firmware {
  id: string
  name: string
  path: string
  buildDate: string
  branch: string
  boardId?: string
  familyId?: string
  size: number
  commitMessage?: string
}
