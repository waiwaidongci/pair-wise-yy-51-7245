import { createReducer, on } from '@ngrx/store'
import type { AuditEntry, HandoverRecord, ReceiveQueueEntry, ReceiveWindow, ReviewComment, RoutePackage, RunningVersion, SegmentConflict, SupervisionCondition, SyncBatch } from '../types'
import * as RouteActions from './route.actions'

export interface RouteState {
  routes: RoutePackage[]
  selectedRouteId: string
  selectedSegmentId: string
  comments: ReviewComment[]
  loading: boolean
  error: string
  version: number
  runningVersions: Record<string, RunningVersion[]>
  handovers: HandoverRecord[]
  conditions: SupervisionCondition[]
  receiveWindows: ReceiveWindow[]
  receiveSeq: number
  syncBatches: SyncBatch[]
  conflicts: SegmentConflict[]
  haltedSegmentIds: string[]
  audit: AuditEntry[]
}

export const initialState: RouteState = {
  routes: [], selectedRouteId: '', selectedSegmentId: '', loading: false, error: '', version: 6,
  comments: [
    { id: 'RV-31', segmentId: 'S-203', role: '安全', author: '韩洁', content: '水源地保护段限速 45 km/h，并要求随车配置吸附围油栏。', status: '待确认', orderId: 'HG-260929-018', version: 1 },
    { id: 'RV-32', segmentId: 'S-207', role: '应急', author: '罗晋', content: '长隧道出口需增加 15 分钟现场监护窗口，接受后方可放行。', status: '已接受', orderId: 'HG-260929-018', version: 1 },
  ],
  runningVersions: {},
  handovers: [
    { id: 'HO-101', orderId: 'HG-260929-018', segmentId: 'S-203', station: '天水', party: '押运员', author: '李岚', content: '罐体压力 0.18MPa，铅封完好，随车吸附物资齐套。', version: 1, offline: false, submittedAt: '今天 15:58', status: '已确认' },
    { id: 'HO-102', orderId: 'HG-260929-018', segmentId: 'S-203', station: '天水', party: '调度', author: '赵鹏', content: 'X8021 天水站 15:42 到、16:05 开，4 道通过。', version: 1, offline: false, submittedAt: '今天 16:06', status: '已确认' },
    { id: 'HO-103', orderId: 'HG-260929-018', segmentId: 'S-203', station: '宝鸡西', party: '接卸站', author: '王宝库', content: '宝鸡西接卸线空闲，具备 28 辆罐车同时作业条件。', version: 1, offline: false, submittedAt: '今天 16:12', status: '待确认' },
    { id: 'HO-104', orderId: 'HG-260929-018', segmentId: 'S-203', station: '天水', party: '押运员', author: '李岚', content: '罐体压力升至 0.21MPa，要求宝鸡西补充吸附围油栏后再放行。', version: 1, offline: true, submittedAt: '今天 16:20', status: '待确认' },
    { id: 'HO-105', orderId: 'HG-260930-006', segmentId: 'S-304', station: '三门峡西', party: '押运员', author: '周航', content: '罐温 24℃，货物状态正常，铅封完好。', version: 1, offline: true, submittedAt: '今天 17:02', status: '已确认' },
    { id: 'HO-106', orderId: 'HG-260930-006', segmentId: 'S-304', station: '洛阳东', party: '调度', author: '吴迪', content: 'X9116 洛阳东 18:20 通过，无甩挂作业。', version: 1, offline: true, submittedAt: '今天 18:25', status: '待确认' },
  ],
  conditions: [],
  receiveWindows: [
    { id: 'W-01', station: '宝鸡西', segmentId: 'S-203', capacity: 1, occupants: [{ orderId: 'HG-260929-018', shift: '白班', submittedAt: '今天 16:10', seq: 1 }], queue: [{ orderId: 'HG-260930-006', shift: '夜班', submittedAt: '今天 16:10', seq: 2 }] },
    { id: 'W-02', station: '郑州北', segmentId: 'S-207', capacity: 1, occupants: [], queue: [] },
    { id: 'W-03', station: '洛阳东', segmentId: 'S-304', capacity: 2, occupants: [], queue: [] },
  ],
  receiveSeq: 2,
  syncBatches: [
    { id: 'B-01', orderId: 'HG-260929-018', recordIds: ['HO-104'], confirmedIds: [], attempts: 0, status: '待回传' },
    { id: 'B-02', orderId: 'HG-260930-006', recordIds: ['HO-105', 'HO-106'], confirmedIds: ['HO-105'], attempts: 1, status: '补传失败' },
  ],
  conflicts: [],
  haltedSegmentIds: [],
  audit: [
    { at: '今天 16:10', text: '宝鸡西接卸窗口：白班 HG-260929-018 与夜班 HG-260930-006 同时提交接车，先到者占用，夜班排队。' },
    { at: '今天 16:20', text: 'HG-260929-018 押运员断网登记交接 HO-104，本地暂存待回传。' },
    { at: '今天 18:25', text: 'B-02 补传失败：HO-105 已确认，HO-106 未确认，恢复后从未确认处续传。' },
  ],
}

/** 旧数据没有运行版本时按首版迁移的默认押运员 */
const DEFAULT_ESCORTS: Record<string, string> = { 'HG-260929-018': '李岚', 'HG-260930-006': '周航' }

function currentVersionNo(runningVersions: Record<string, RunningVersion[]>, orderId: string): number {
  const list = runningVersions[orderId]
  return list?.length ? list[list.length - 1].no : 1
}

/** 按运行版本重算监护条件：中、高风险区段逐段生成 */
function seedConditions(route: RoutePackage, no: number): SupervisionCondition[] {
  return route.segments
    .filter((segment) => segment.level !== '低')
    .map((segment) => ({
      id: `SC-${route.id}-${segment.id}-v${no}`,
      orderId: route.id,
      segmentId: segment.id,
      content: `${segment.name}：${segment.risks.join('、')}，${segment.speed}，全程双人监护。`,
      version: no,
      status: '有效' as const,
    }))
}

/** 押运员或编组变更：升运行版本，相关监护条件与会签失效重算，其余保留依据 */
function bumpVersion(state: RouteState, orderId: string, patch: { escort?: string; marshalling?: string }, reason: string, at: string): RouteState {
  const versions = state.runningVersions[orderId]
  if (!versions?.length) return state
  const prev = versions[versions.length - 1]
  const next: RunningVersion = { no: prev.no + 1, escort: patch.escort ?? prev.escort, marshalling: patch.marshalling ?? prev.marshalling, createdAt: at, reason }
  const route = state.routes.find((item) => item.id === orderId)
  return {
    ...state,
    runningVersions: { ...state.runningVersions, [orderId]: [...versions, next] },
    conditions: [
      ...state.conditions.map((condition) => (condition.orderId === orderId && condition.status === '有效' ? { ...condition, status: '失效重算' as const } : condition)),
      ...(route ? seedConditions(route, next.no) : []),
    ],
    comments: state.comments.map((comment) => (comment.orderId === orderId ? { ...comment, status: '失效重算' as const } : comment)),
    audit: [...state.audit, { at, text: `${orderId} ${reason}，运行版本升至 v${next.no}：相关监护条件与会签失效重算，其余保留依据。` }],
  }
}

interface MergeContext {
  routes: RoutePackage[]
  handovers: HandoverRecord[]
  conflicts: SegmentConflict[]
  haltedSegmentIds: string[]
  audit: AuditEntry[]
}

/**
 * 按单号合并一个回传批次：已确认的记录跳过（重复回传只算第一次），
 * 同一区段两边都改则各留一版并停住高危段放行。
 */
function mergePendingRecords(batch: SyncBatch, ctx: MergeContext, at: string): SyncBatch {
  const confirmed = [...batch.confirmedIds]
  for (const recordId of batch.recordIds) {
    if (confirmed.includes(recordId)) continue
    const record = ctx.handovers.find((item) => item.id === recordId)
    if (!record) continue
    const existing = ctx.handovers.find((item) => item.id !== recordId && item.orderId === record.orderId && item.segmentId === record.segmentId && item.party === record.party && !item.offline)
    if (existing && existing.content !== record.content) {
      ctx.handovers = ctx.handovers.map((item) => (item.id === recordId || item.id === existing.id ? { ...item, status: '冲突保留' as const } : item))
      ctx.conflicts = [...ctx.conflicts, { orderId: record.orderId, segmentId: record.segmentId, localId: existing.id, remoteId: record.id }]
      const segment = ctx.routes.find((route) => route.id === record.orderId)?.segments.find((item) => item.id === record.segmentId)
      if (segment?.level === '高' && !ctx.haltedSegmentIds.includes(segment.id)) ctx.haltedSegmentIds = [...ctx.haltedSegmentIds, segment.id]
      ctx.audit = [...ctx.audit, { at, text: `${record.orderId} · ${record.segmentId} 同一区段两边都改：本端与回传各留一版，高危段停住放行。` }]
    } else {
      ctx.handovers = ctx.handovers.map((item) => (item.id === recordId ? { ...item, status: '已确认' as const } : item))
      confirmed.push(recordId)
    }
  }
  const done = batch.recordIds.every((id) => confirmed.includes(id))
  return { ...batch, confirmedIds: confirmed, attempts: batch.attempts + 1, status: done ? '已确认' : '部分确认' }
}

export const routeReducer = createReducer(
  initialState,
  on(RouteActions.loadRoutes, (state) => ({ ...state, loading: true, error: '' })),
  on(RouteActions.loadRoutesSuccess, (state, { routes }) => {
    // 旧数据没有运行版本时按首版迁移：运输单、运行区段与押运交接接入同一运行版本
    const runningVersions = { ...state.runningVersions }
    let conditions = [...state.conditions]
    let audit = [...state.audit]
    for (const route of routes) {
      if (!runningVersions[route.id]?.length) {
        runningVersions[route.id] = [{ no: 1, escort: DEFAULT_ESCORTS[route.id] ?? '待指派押运员', marshalling: `${route.wagonCount} 辆 · ${route.hazardClass}专用编组`, createdAt: route.updatedAt, reason: '旧数据按首版迁移' }]
        conditions = [...conditions, ...seedConditions(route, 1)]
        audit = [...audit, { at: route.updatedAt, text: `${route.id} 无运行版本，按首版 v1 迁移：运输单、运行区段与押运交接接入同一运行版本。` }]
      }
    }
    return { ...state, loading: false, routes, runningVersions, conditions, audit, selectedRouteId: state.selectedRouteId || routes[0]?.id || '', selectedSegmentId: state.selectedSegmentId || routes[0]?.segments[0]?.id || '' }
  }),
  on(RouteActions.loadRoutesFailure, (state, { error }) => ({ ...state, loading: false, error })),
  on(RouteActions.selectRoute, (state, { id }) => ({ ...state, selectedRouteId: id, selectedSegmentId: state.routes.find((route) => route.id === id)?.segments[0]?.id ?? '' })),
  on(RouteActions.selectSegment, (state, { id }) => ({ ...state, selectedSegmentId: id })),
  on(RouteActions.updateSegmentLevel, (state, { id, level }) => ({
    ...state,
    version: state.version + 1,
    routes: state.routes.map((route) => ({ ...route, segments: route.segments.map((segment) => segment.id === id ? { ...segment, level, status: level === '高' ? '需绕行' as const : '待复核' as const } : segment) })),
  })),
  on(RouteActions.addComment, (state, { comment }) => ({ ...state, comments: [comment, ...state.comments] })),
  on(RouteActions.resolveComment, (state, { id, status }) => ({ ...state, comments: state.comments.map((comment) => comment.id === id ? { ...comment, status } : comment) })),
  on(RouteActions.createAlternative, (state) => ({
    ...state,
    version: state.version + 1,
    routes: state.routes.map((route) => route.id === state.selectedRouteId ? { ...route, id: `${route.id}-ALT`, score: Math.max(72, route.score - 2) } : route),
  })),

  // 中间站三方交接：押运员、调度、接卸站各记一份，锚定当前运行版本；断网登记本地暂存待回传
  on(RouteActions.recordHandover, (state, { record, batchId, at }) => {
    const no = currentVersionNo(state.runningVersions, record.orderId)
    const saved: HandoverRecord = { ...record, version: no }
    const text = `${saved.orderId} · ${saved.station} ${saved.party}登记交接 ${saved.id}（运行版本 v${no}）${saved.offline ? '，断网本地暂存待回传' : ''}。`
    if (!saved.offline) return { ...state, handovers: [saved, ...state.handovers], audit: [...state.audit, { at, text }] }
    const batch: SyncBatch = { id: batchId, orderId: saved.orderId, recordIds: [saved.id], confirmedIds: [], attempts: 0, status: '待回传' }
    return { ...state, handovers: [saved, ...state.handovers], syncBatches: [batch, ...state.syncBatches], audit: [...state.audit, { at, text }] }
  }),
  on(RouteActions.confirmHandover, (state, { id, at }) => ({
    ...state,
    handovers: state.handovers.map((item) => (item.id === id ? { ...item, status: '已确认' as const } : item)),
    audit: [...state.audit, { at, text: `交接 ${id} 已确认。` }],
  })),

  // 押运员或编组一变：相关监护条件和会签失效重算，其余保留依据
  on(RouteActions.changeEscort, (state, { orderId, escort, at }) => bumpVersion(state, orderId, { escort }, `押运员变更为 ${escort}`, at)),
  on(RouteActions.changeMarshalling, (state, { orderId, marshalling, at }) => bumpVersion(state, orderId, { marshalling }, `编组变更为 ${marshalling}`, at)),

  // 接卸窗口：不足就排队并写明占用者；两班同时提交只让先到者占用（seq 递增即到达顺序）
  on(RouteActions.submitReceive, (state, { windowId, orderId, shift, at }) => {
    const window = state.receiveWindows.find((item) => item.id === windowId)
    if (!window) return state
    if (window.occupants.some((entry) => entry.orderId === orderId) || window.queue.some((entry) => entry.orderId === orderId)) {
      return { ...state, audit: [...state.audit, { at, text: `${orderId} 已在 ${window.station} 窗口占用/排队中，重复提交忽略。` }] }
    }
    const seq = state.receiveSeq + 1
    const entry: ReceiveQueueEntry = { orderId, shift, submittedAt: at, seq }
    const occupy = window.occupants.length < window.capacity
    const receiveWindows = state.receiveWindows.map((item) => item.id === windowId
      ? (occupy ? { ...item, occupants: [...item.occupants, entry] } : { ...item, queue: [...item.queue, entry] })
      : item)
    const text = occupy
      ? `${orderId}（${shift}）提交接车，占用 ${window.station} 接卸窗口。`
      : `${window.station} 接卸窗口不足：${orderId}（${shift}）排队，当前占用者 ${window.occupants.map((item) => `${item.orderId}（${item.shift}）`).join('、')}。`
    return { ...state, receiveWindows, receiveSeq: seq, audit: [...state.audit, { at, text }] }
  }),
  on(RouteActions.releaseReceiveWindow, (state, { windowId, at }) => {
    const window = state.receiveWindows.find((item) => item.id === windowId)
    if (!window || !window.occupants.length) return state
    const [leaving, ...restOccupants] = window.occupants
    const [head, ...restQueue] = window.queue
    const receiveWindows = state.receiveWindows.map((item) => item.id === windowId
      ? { ...item, occupants: head ? [...restOccupants, head] : restOccupants, queue: restQueue }
      : item)
    const text = head
      ? `${window.station} 窗口释放：${leaving.orderId} 离开，排队先到者 ${head.orderId}（${head.shift}）占用。`
      : `${window.station} 窗口释放：${leaving.orderId} 离开，窗口空闲。`
    return { ...state, receiveWindows, audit: [...state.audit, { at, text }] }
  }),

  // 断网交接回网后按单号合并
  on(RouteActions.syncOffline, (state, { at }) => {
    const pending = state.syncBatches.filter((batch) => batch.status !== '已确认')
    if (!pending.length) return { ...state, audit: [...state.audit, { at, text: '回网合并：无待回传批次。' }] }
    const ctx: MergeContext = { routes: state.routes, handovers: [...state.handovers], conflicts: [...state.conflicts], haltedSegmentIds: [...state.haltedSegmentIds], audit: [...state.audit] }
    const syncBatches = state.syncBatches.map((batch) => (batch.status === '已确认' ? batch : mergePendingRecords(batch, ctx, at)))
    return { ...state, handovers: ctx.handovers, conflicts: ctx.conflicts, haltedSegmentIds: ctx.haltedSegmentIds, syncBatches, audit: [...ctx.audit, { at, text: `回网合并完成：按单号合并 ${pending.length} 个批次。` }] }
  }),

  // 补传失败后从未确认处恢复；重复回传只算第一次
  on(RouteActions.retryBatch, (state, { batchId, at }) => {
    const batch = state.syncBatches.find((item) => item.id === batchId)
    if (!batch) return state
    if (batch.status === '已确认') return { ...state, audit: [...state.audit, { at, text: `${batchId} 重复回传：只计首次，本次回传忽略。` }] }
    const resumed = batch.recordIds.filter((id) => !batch.confirmedIds.includes(id))
    const ctx: MergeContext = { routes: state.routes, handovers: [...state.handovers], conflicts: [...state.conflicts], haltedSegmentIds: [...state.haltedSegmentIds], audit: [...state.audit] }
    const updated = mergePendingRecords(batch, ctx, at)
    return {
      ...state,
      handovers: ctx.handovers,
      conflicts: ctx.conflicts,
      haltedSegmentIds: ctx.haltedSegmentIds,
      syncBatches: state.syncBatches.map((item) => (item.id === batchId ? updated : item)),
      audit: [...ctx.audit, { at, text: `${batchId} 补传从未确认处恢复：续传 ${resumed.length} 条（${resumed.join('、') || '无'}），已确认 ${batch.confirmedIds.length} 条不重传。` }],
    }
  }),

  // 冲突裁决：采用一版，另一版留存备查；该单无其他冲突时高危段恢复放行
  on(RouteActions.resolveConflict, (state, { orderId, segmentId, keep, at }) => {
    const conflict = state.conflicts.find((item) => item.orderId === orderId && item.segmentId === segmentId)
    if (!conflict) return state
    const keepId = keep === 'local' ? conflict.localId : conflict.remoteId
    const conflicts = state.conflicts.filter((item) => item !== conflict)
    const stillConflicted = conflicts.some((item) => item.orderId === orderId)
    const orderSegmentIds = new Set(state.routes.find((route) => route.id === orderId)?.segments.map((segment) => segment.id) ?? [])
    return {
      ...state,
      handovers: state.handovers.map((item) => (item.id === keepId ? { ...item, status: '已确认' as const } : item)),
      conflicts,
      haltedSegmentIds: stillConflicted ? state.haltedSegmentIds : state.haltedSegmentIds.filter((id) => !orderSegmentIds.has(id)),
      syncBatches: state.syncBatches.map((batch) => {
        if (!batch.recordIds.includes(conflict.remoteId)) return batch
        const confirmedIds = [...new Set([...batch.confirmedIds, conflict.remoteId])]
        const done = batch.recordIds.every((id) => confirmedIds.includes(id))
        return { ...batch, confirmedIds, status: done ? '已确认' as const : '部分确认' as const }
      }),
      audit: [...state.audit, { at, text: `${orderId} · ${segmentId} 冲突裁决：采用${keep === 'local' ? '本端' : '回传'}版，另一版留存备查${stillConflicted ? '。' : '，该单高危段恢复放行。'}` }],
    }
  }),
)
