import { createAction, props } from '@ngrx/store'
import type { HandoverRecord, ReviewComment, RiskLevel, RoutePackage } from '../types'

export const loadRoutes = createAction('[Route Workbench] Load Routes')
export const loadRoutesSuccess = createAction('[Route API] Load Routes Success', props<{ routes: RoutePackage[] }>())
export const loadRoutesFailure = createAction('[Route API] Load Routes Failure', props<{ error: string }>())
export const selectRoute = createAction('[Route Workbench] Select Route', props<{ id: string }>())
export const selectSegment = createAction('[Risk Map] Select Segment', props<{ id: string }>())
export const updateSegmentLevel = createAction('[Risk Map] Update Level', props<{ id: string; level: RiskLevel }>())
export const addComment = createAction('[Approval] Add Comment', props<{ comment: ReviewComment }>())
export const resolveComment = createAction('[Approval] Resolve Comment', props<{ id: string; status: ReviewComment['status'] }>())
export const createAlternative = createAction('[Risk Map] Create Alternative')

// 押运交接与运行版本
export const recordHandover = createAction('[Handover] Record', props<{ record: HandoverRecord; batchId: string; at: string }>())
export const confirmHandover = createAction('[Handover] Confirm', props<{ id: string; at: string }>())
export const changeEscort = createAction('[Handover] Change Escort', props<{ orderId: string; escort: string; at: string }>())
export const changeMarshalling = createAction('[Handover] Change Marshalling', props<{ orderId: string; marshalling: string; at: string }>())
export const submitReceive = createAction('[Handover] Submit Receive', props<{ windowId: string; orderId: string; shift: string; at: string }>())
export const releaseReceiveWindow = createAction('[Handover] Release Receive Window', props<{ windowId: string; at: string }>())
export const syncOffline = createAction('[Handover] Sync Offline', props<{ at: string }>())
export const retryBatch = createAction('[Handover] Retry Batch', props<{ batchId: string; at: string }>())
export const resolveConflict = createAction('[Handover] Resolve Conflict', props<{ orderId: string; segmentId: string; keep: 'local' | 'remote'; at: string }>())
