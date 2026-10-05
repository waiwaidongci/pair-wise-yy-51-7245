export type RiskLevel = '高' | '中' | '低'

export interface RiskSegment {
  id: string
  name: string
  from: string
  to: string
  km: string
  speed: string
  risks: string[]
  level: RiskLevel
  status: '待复核' | '已确认' | '需绕行'
  coordinates: [number, number][]
}

export interface RoutePackage {
  id: string
  cargo: string
  hazardClass: string
  trainCode: string
  origin: string
  destination: string
  tonnage: number
  wagonCount: number
  permit: string
  permission: '有效' | '缺失' | '待补充'
  score: number
  updatedAt: string
  segments: RiskSegment[]
}

export interface ReviewComment {
  id: string
  segmentId: string
  role: string
  author: string
  content: string
  status: '待确认' | '已接受' | '已退回' | '失效重算'
  orderId?: string
  version?: number
}

export type HandoverParty = '押运员' | '调度' | '接卸站'

/** 中间站三方交接记录，锚定运输单 + 运行区段 + 运行版本 */
export interface HandoverRecord {
  id: string
  orderId: string
  segmentId: string
  station: string
  party: HandoverParty
  author: string
  content: string
  version: number
  offline: boolean
  submittedAt: string
  status: '待确认' | '已确认' | '冲突保留'
}

/** 运行版本：押运员或编组一变即升版 */
export interface RunningVersion {
  no: number
  escort: string
  marshalling: string
  createdAt: string
  reason: string
}

/** 监护条件：随运行版本失效重算 */
export interface SupervisionCondition {
  id: string
  orderId: string
  segmentId: string
  content: string
  version: number
  status: '有效' | '失效重算'
}

export interface ReceiveQueueEntry {
  orderId: string
  shift: string
  submittedAt: string
  seq: number
}

/** 接卸窗口：容量不足排队并写明占用者，同时提交先到者占用 */
export interface ReceiveWindow {
  id: string
  station: string
  segmentId: string
  capacity: number
  occupants: ReceiveQueueEntry[]
  queue: ReceiveQueueEntry[]
}

/** 断网交接的回传批次：confirmedIds 是补传断点恢复的依据 */
export interface SyncBatch {
  id: string
  orderId: string
  recordIds: string[]
  confirmedIds: string[]
  attempts: number
  status: '待回传' | '部分确认' | '补传失败' | '已确认'
}

/** 同一区段两边都改：本端与回传各留一版 */
export interface SegmentConflict {
  orderId: string
  segmentId: string
  localId: string
  remoteId: string
}

export interface AuditEntry {
  at: string
  text: string
}
