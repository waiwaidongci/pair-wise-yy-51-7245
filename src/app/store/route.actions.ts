import { createAction, props } from '@ngrx/store'
import type {
  EscortHandover,
  HandoverConflict,
  MonitoringCondition,
  ReceptionRequest,
  ReceivingWindow,
  ReviewComment,
  RiskLevel,
  RoutePackage,
  RunningVersion,
} from '../types'

export const loadRoutes = createAction('[Route Workbench] Load Routes')
export const loadRoutesSuccess = createAction('[Route API] Load Routes Success', props<{ routes: RoutePackage[] }>())
export const loadRoutesFailure = createAction('[Route API] Load Routes Failure', props<{ error: string }>())
export const selectRoute = createAction('[Route Workbench] Select Route', props<{ id: string }>())
export const selectSegment = createAction('[Risk Map] Select Segment', props<{ id: string }>())
export const updateSegmentLevel = createAction('[Risk Map] Update Level', props<{ id: string; level: RiskLevel }>())
export const addComment = createAction('[Approval] Add Comment', props<{ comment: ReviewComment }>())
export const resolveComment = createAction('[Approval] Resolve Comment', props<{ id: string; status: ReviewComment['status'] }>())
export const createAlternative = createAction('[Risk Map] Create Alternative')

// —— 运行版本：运输单/区段/交接共用同一版本，押运员或编组一变即升级 ——
export const initRunningVersions = createAction('[Running Version] Init Running Versions')
export const changeEscort = createAction('[Running Version] Change Escort', props<{ orderId: string; escort: string; reason: string }>())
export const changeFormation = createAction('[Running Version] Change Formation', props<{ orderId: string; formation: string; reason: string }>())
export const recalculateConditions = createAction('[Running Version] Recalculate Conditions', props<{ orderId: string }>())
export const recalculateConditionsSuccess = createAction('[Running Version] Recalculate Conditions Success', props<{ orderId: string }>())

// —— 押运交接：到中间站后押运员、调度、接卸站各记一份 ——
export const recordHandover = createAction('[Handover] Record Handover', props<{ handover: EscortHandover }>())
export const syncHandover = createAction('[Handover] Sync Handover', props<{ id: string }>())
export const syncHandoverSuccess = createAction('[Handover] Sync Success', props<{ id: string; confirmedAt: string }>())
export const syncHandoverFailure = createAction('[Handover] Sync Failure', props<{ id: string }>())
export const mergeOfflineHandovers = createAction('[Handover] Merge Offline')
export const mergeOfflineHandoversSuccess = createAction('[Handover] Merge Offline Success', props<{ handovers: EscortHandover[] }>())

// —— 接卸窗口：不足排队写明占用者，两班同时提交只让先到者占用 ——
export const submitReception = createAction('[Window] Submit Reception', props<{ request: ReceptionRequest }>())
export const assignWindow = createAction('[Window] Assign Window', props<{ requestId: string; windowId: string }>())
export const releaseWindow = createAction('[Window] Release Window', props<{ requestId: string }>())

// —— 补传：失败后从未确认处恢复，重复回传只算第一次 ——
export const retryTransmission = createAction('[Handover] Retry Transmission', props<{ id: string }>())
export const retryAllPending = createAction('[Handover] Retry All Pending')

// —— 监护条件 ——
export const addCondition = createAction('[Condition] Add Condition', props<{ condition: MonitoringCondition }>())
export const resolveCondition = createAction('[Condition] Resolve Condition', props<{ id: string; status: MonitoringCondition['status'] }>())

// —— 窗口数据加载 ——
export const loadWindows = createAction('[Window] Load Windows', props<{ windows: ReceivingWindow[] }>())

export type RouteActions =
  | ReturnType<typeof loadRoutes>
  | ReturnType<typeof loadRoutesSuccess>
  | ReturnType<typeof loadRoutesFailure>
  | ReturnType<typeof selectRoute>
  | ReturnType<typeof selectSegment>
  | ReturnType<typeof updateSegmentLevel>
  | ReturnType<typeof addComment>
  | ReturnType<typeof resolveComment>
  | ReturnType<typeof createAlternative>
  | ReturnType<typeof initRunningVersions>
  | ReturnType<typeof changeEscort>
  | ReturnType<typeof changeFormation>
  | ReturnType<typeof recalculateConditions>
  | ReturnType<typeof recordHandover>
  | ReturnType<typeof syncHandover>
  | ReturnType<typeof syncHandoverSuccess>
  | ReturnType<typeof syncHandoverFailure>
  | ReturnType<typeof mergeOfflineHandovers>
  | ReturnType<typeof mergeOfflineHandoversSuccess>
  | ReturnType<typeof submitReception>
  | ReturnType<typeof assignWindow>
  | ReturnType<typeof releaseWindow>
  | ReturnType<typeof retryTransmission>
  | ReturnType<typeof retryAllPending>
  | ReturnType<typeof addCondition>
  | ReturnType<typeof resolveCondition>
  | ReturnType<typeof loadWindows>
  | RunningVersion
