export type RiskLevel = '高' | '中' | '低'

/** 交接三方角色：押运员、调度、接卸站 */
export type HandoverRole = '押运员' | '调度' | '接卸站'

/** 交接同步状态 */
export type SyncStatus = '已同步' | '待同步' | '同步失败' | '未确认'

/** 条件/会签与变更的相关方，用于判断失效范围 */
export type ConditionRelation = '押运员' | '编组' | '区段' | '货物' | '其他'

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
  /** 所属运行版本，旧数据迁移后补 1 */
  version?: number
}

export interface RoutePackage {
  id: string
  cargo: string
  hazardClass: string
  /** 编组（发车编组快照） */
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
  /** 押运员，押运员一变即触发运行版本升级 */
  escort?: string
  /** 当前运行版本号，运输单/区段/交接共用 */
  currentVersion?: number
  /** 发车编组快照，审批仍按此放行 */
  departureFormation?: string
}

export interface ReviewComment {
  id: string
  segmentId: string
  role: string
  author: string
  content: string
  status: '待确认' | '已接受' | '已退回' | '失效'
  /** 所属运行版本 */
  version?: number
  /** 保留依据：失效重算时其余会签保留其依据 */
  basis?: string
  /** 相关方：押运员或编组变更时，命中相关方的会签失效 */
  relatesTo?: ConditionRelation
}

/** 押运交接：列车到中间站后由押运员、调度、接卸站各记一份 */
export interface EscortHandover {
  id: string
  /** 运输单号，断网回网后按此合并 */
  transportOrderId: string
  sectionId: string
  station: string
  role: HandoverRole
  operator: string
  content: string
  recordedAt: string
  /** 交接发生时的运行版本 */
  version: number
  syncStatus: SyncStatus
  basis?: string
  /** 确认时间，补传失败后从未确认处恢复 */
  confirmedAt?: string
}

/** 运行版本：把运输单、运行区段、押运交接接到同一版本 */
export interface RunningVersion {
  version: number
  transportOrderId: string
  /** 编组快照 */
  formation: string
  /** 押运员快照 */
  escort: string
  changedAt: string
  reason: string
  /** 变更依据 */
  basis: string
}

/** 监护条件：押运员或编组一变，相关条件失效重算 */
export interface MonitoringCondition {
  id: string
  transportOrderId: string
  sectionId: string
  content: string
  status: '有效' | '失效' | '重算中'
  /** 保留依据 */
  basis: string
  version: number
  relatesTo: ConditionRelation
}

/** 接卸窗口 */
export interface ReceivingWindow {
  id: string
  station: string
  startTime: string
  endTime: string
  capacity: number
  occupied: number
  /** 占用者：窗口不足排队时写明 */
  occupant: string
  status: '空闲' | '占用' | '排队中'
}

/** 接车申请：两班同时提交只让先到者占用 */
export interface ReceptionRequest {
  id: string
  transportOrderId: string
  station: string
  shift: string
  submittedAt: string
  status: '待处理' | '已占用' | '排队' | '已拒绝'
  windowId?: string
  occupant?: string
}

/** 排队记录 */
export interface QueueEntry {
  id: string
  windowId: string
  requestId: string
  position: number
  queuedAt: string
}

/** 断网交接合并冲突：同一区段两边都改各留一版，高危段停住放行 */
export interface HandoverConflict {
  transportOrderId: string
  sectionId: string
  localVersion: number
  remoteVersion: number
  reason: string
  /** 高危段停住放行 */
  releaseBlocked: boolean
}
