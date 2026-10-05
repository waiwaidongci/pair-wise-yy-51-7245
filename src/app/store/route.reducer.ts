import { createReducer, on } from '@ngrx/store'
import type {
  ConditionRelation,
  EscortHandover,
  HandoverConflict,
  MonitoringCondition,
  ReceptionRequest,
  ReceivingWindow,
  ReviewComment,
  RoutePackage,
  RunningVersion,
} from '../types'
import * as RouteActions from './route.actions'

export interface RouteState {
  routes: RoutePackage[]
  selectedRouteId: string
  selectedSegmentId: string
  comments: ReviewComment[]
  handovers: EscortHandover[]
  runningVersions: RunningVersion[]
  conditions: MonitoringCondition[]
  windows: ReceivingWindow[]
  receptionRequests: ReceptionRequest[]
  queue: import('../types').QueueEntry[]
  conflicts: HandoverConflict[]
  loading: boolean
  error: string
  version: number
  migrated: boolean
}

const initialWindows: ReceivingWindow[] = [
  { id: 'WIN-ZZ-01', station: '郑州北', startTime: '08:00', endTime: '12:00', capacity: 2, occupied: 0, occupant: '', status: '空闲' },
  { id: 'WIN-ZZ-02', station: '郑州北', startTime: '13:00', endTime: '17:00', capacity: 1, occupied: 0, occupant: '', status: '空闲' },
  { id: 'WIN-NJ-01', station: '南京东', startTime: '09:00', endTime: '18:00', capacity: 3, occupied: 0, occupant: '', status: '空闲' },
]

const initialConditions: MonitoringCondition[] = [
  { id: 'COND-01', transportOrderId: 'HG-260929-018', sectionId: 'S-203', content: '水源地保护段限速 45 km/h，随车配置吸附围油栏', status: '有效', basis: 'RV-31 会签意见', version: 1, relatesTo: '区段' },
  { id: 'COND-02', transportOrderId: 'HG-260929-018', sectionId: 'S-207', content: '长隧道出口增加 15 分钟现场监护窗口', status: '有效', basis: 'RV-32 会签意见', version: 1, relatesTo: '区段' },
]

const initialHandovers: EscortHandover[] = [
  { id: 'HO-001', transportOrderId: 'HG-260929-018', sectionId: 'S-201', station: '兰州西', role: '押运员', operator: '张师傅', content: '押运状态正常，货物无异常', recordedAt: '今天 08:15', version: 1, syncStatus: '已同步', confirmedAt: '今天 08:16' },
  { id: 'HO-002', transportOrderId: 'HG-260929-018', sectionId: 'S-201', station: '兰州西', role: '调度', operator: '李调度', content: '编组正确，具备发车条件', recordedAt: '今天 08:16', version: 1, syncStatus: '已同步', confirmedAt: '今天 08:17' },
  { id: 'HO-003', transportOrderId: 'HG-260929-018', sectionId: 'S-201', station: '兰州西', role: '接卸站', operator: '王站长', content: '接卸准备就绪', recordedAt: '今天 08:17', version: 1, syncStatus: '已同步', confirmedAt: '今天 08:18' },
  { id: 'HO-004', transportOrderId: 'HG-260929-018', sectionId: 'S-203', station: '天水', role: '押运员', operator: '张师傅', content: '运行正常，准备进入水源地段', recordedAt: '今天 10:30', version: 1, syncStatus: '同步失败' },
]

export const initialState: RouteState = {
  routes: [], selectedRouteId: '', selectedSegmentId: '', loading: false, error: '', version: 6, migrated: false,
  comments: [
    { id: 'RV-31', segmentId: 'S-203', role: '安全', author: '韩洁', content: '水源地保护段限速 45 km/h，并要求随车配置吸附围油栏。', status: '待确认' },
    { id: 'RV-32', segmentId: 'S-207', role: '应急', author: '罗晋', content: '长隧道出口需增加 15 分钟现场监护窗口，接受后方可放行。', status: '已接受' },
  ],
  handovers: initialHandovers,
  runningVersions: [],
  conditions: initialConditions,
  windows: initialWindows,
  receptionRequests: [],
  queue: [],
  conflicts: [],
}

// —— 旧数据迁移：没有运行版本的运输单按首版 v1 迁移 ——
function migrateRoute(route: RoutePackage): RoutePackage {
  if (route.currentVersion !== undefined) return route
  return {
    ...route,
    currentVersion: 1,
    departureFormation: route.trainCode,
    escort: route.escort || '待指定',
    segments: route.segments.map((segment) => ({ ...segment, version: 1 })),
  }
}

function inferRelation(comment: ReviewComment): ConditionRelation {
  const text = comment.content
  if (/押运|押运员|资质|监护/.test(text)) return '押运员'
  if (/编组|车列|隔离|发车/.test(text)) return '编组'
  if (/区段|隧道|桥梁|水源|限速|道口/.test(text)) return '区段'
  if (/货物|危险|甲醇|氢氧化钠|UN/.test(text)) return '货物'
  return '其他'
}

function migrateComment(comment: ReviewComment, routes: RoutePackage[]): ReviewComment {
  if (comment.version !== undefined) return comment
  const route = routes.find((item) => item.segments.some((segment) => segment.id === comment.segmentId))
  return { ...comment, version: route?.currentVersion ?? 1, basis: comment.content, relatesTo: inferRelation(comment) }
}

function buildRunningVersion(route: RoutePackage, reason: string, basis: string): RunningVersion {
  return {
    version: route.currentVersion ?? 1,
    transportOrderId: route.id,
    formation: route.trainCode,
    escort: route.escort || '待指定',
    changedAt: '刚刚',
    reason,
    basis,
  }
}

// —— 押运员或编组一变，相关监护条件和会签失效，其余保留依据 ——
function invalidateRelated(state: RouteState, orderId: string, relation: ConditionRelation): Pick<RouteState, 'conditions' | 'comments'> {
  const conditions = state.conditions.map((condition) =>
    condition.transportOrderId === orderId && condition.relatesTo === relation
      ? { ...condition, status: '失效' as const }
      : condition,
  )
  const comments = state.comments.map((comment) => {
    const route = state.routes.find((item) => item.id === orderId)
    const belongs = route?.segments.some((segment) => segment.id === comment.segmentId)
    return belongs && comment.relatesTo === relation ? { ...comment, status: '失效' as const } : comment
  })
  return { conditions, comments }
}

function nextVersion(state: RouteState, orderId: string, reason: string, basis: string): RouteState {
  const routes = state.routes.map((route) => {
    if (route.id !== orderId) return route
    const current = route.currentVersion ?? 1
    return { ...route, currentVersion: current + 1, segments: route.segments.map((segment) => ({ ...segment, version: current + 1 })) }
  })
  const updated = routes.find((route) => route.id === orderId)!
  const runningVersions = [...state.runningVersions, buildRunningVersion(updated, reason, basis)]
  return { ...state, routes, runningVersions }
}

export const routeReducer = createReducer(
  initialState,
  on(RouteActions.loadRoutes, (state) => ({ ...state, loading: true, error: '' })),
  on(RouteActions.loadRoutesSuccess, (state, { routes }) => {
    const migratedRoutes = routes.map(migrateRoute)
    const migratedComments = state.comments.map((comment) => migrateComment(comment, migratedRoutes))
    const versions: RunningVersion[] = migratedRoutes
      .filter((route) => !state.runningVersions.some((version) => version.transportOrderId === route.id))
      .map((route) => buildRunningVersion(route, '旧数据迁移首版', '历史编组与押运记录'))
    return {
      ...state,
      loading: false,
      routes: migratedRoutes,
      comments: migratedComments,
      runningVersions: [...state.runningVersions, ...versions],
      selectedRouteId: state.selectedRouteId || migratedRoutes[0]?.id || '',
      selectedSegmentId: state.selectedSegmentId || migratedRoutes[0]?.segments[0]?.id || '',
      migrated: true,
    }
  }),
  on(RouteActions.loadRoutesFailure, (state, { error }) => ({ ...state, loading: false, error })),
  on(RouteActions.selectRoute, (state, { id }) => ({ ...state, selectedRouteId: id, selectedSegmentId: state.routes.find((route) => route.id === id)?.segments[0]?.id ?? '' })),
  on(RouteActions.selectSegment, (state, { id }) => ({ ...state, selectedSegmentId: id })),
  on(RouteActions.updateSegmentLevel, (state, { id, level }) => ({
    ...state,
    version: state.version + 1,
    routes: state.routes.map((route) => ({ ...route, segments: route.segments.map((segment) => segment.id === id ? { ...segment, level, status: level === '高' ? '需绕行' as const : '待复核' as const } : segment) })),
  })),
  on(RouteActions.addComment, (state, { comment }) => {
    const route = state.routes.find((item) => item.segments.some((segment) => segment.id === comment.segmentId))
    const enriched: ReviewComment = {
      ...comment,
      version: comment.version ?? route?.currentVersion ?? 1,
      basis: comment.basis ?? comment.content,
      relatesTo: comment.relatesTo ?? inferRelation(comment),
    }
    return { ...state, comments: [enriched, ...state.comments] }
  }),
  on(RouteActions.resolveComment, (state, { id, status }) => ({ ...state, comments: state.comments.map((comment) => comment.id === id ? { ...comment, status } : comment) })),
  on(RouteActions.createAlternative, (state) => ({
    ...state,
    version: state.version + 1,
    routes: state.routes.map((route) => route.id === state.selectedRouteId ? { ...route, id: `${route.id}-ALT`, score: Math.max(72, route.score - 2) } : route),
  })),

  // —— 运行版本升级：押运员变更 ——
  on(RouteActions.changeEscort, (state, { orderId, escort, reason }) => {
    const stepped = nextVersion(state, orderId, reason, `押运员变更为 ${escort}`)
    const routes = stepped.routes.map((route) => route.id === orderId ? { ...route, escort } : route)
    const { conditions, comments } = invalidateRelated({ ...stepped, routes }, orderId, '押运员')
    return { ...stepped, routes, conditions, comments }
  }),

  // —— 运行版本升级：编组变更 ——
  on(RouteActions.changeFormation, (state, { orderId, formation, reason }) => {
    const stepped = nextVersion(state, orderId, reason, `编组变更为 ${formation}`)
    const routes = stepped.routes.map((route) => route.id === orderId ? { ...route, trainCode: formation } : route)
    const { conditions, comments } = invalidateRelated({ ...stepped, routes }, orderId, '编组')
    return { ...stepped, routes, conditions, comments }
  }),

  // —— 失效重算：先置重算中，其余保留依据 ——
  on(RouteActions.recalculateConditions, (state, { orderId }) => ({
    ...state,
    conditions: state.conditions.map((condition) =>
      condition.transportOrderId === orderId && condition.status === '失效'
        ? { ...condition, status: '重算中' as const }
        : condition,
    ),
    comments: state.comments.map((comment) => {
      const route = state.routes.find((item) => item.id === orderId)
      const belongs = route?.segments.some((segment) => segment.id === comment.segmentId)
      return belongs && comment.status === '失效' ? { ...comment, status: '待确认' as const } : comment
    }),
  })),
  on(RouteActions.recalculateConditionsSuccess, (state, { orderId }) => ({
    ...state,
    conditions: state.conditions.map((condition) =>
      condition.transportOrderId === orderId && condition.status === '重算中'
        ? { ...condition, status: '有效' as const, basis: `${condition.basis} · 重算依据 v${state.routes.find((r) => r.id === orderId)?.currentVersion ?? 1}` }
        : condition,
    ),
    comments: state.comments.map((comment) => {
      const route = state.routes.find((item) => item.id === orderId)
      const belongs = route?.segments.some((segment) => segment.id === comment.segmentId)
      return belongs && comment.status === '待确认' && comment.relatesTo === '押运员'
        ? { ...comment, status: '已接受' as const, basis: `${comment.basis ?? comment.content} · 重算确认` }
        : comment
    }),
  })),

  // —— 押运交接：记录到当前运行版本 ——
  on(RouteActions.recordHandover, (state, { handover }) => {
    const route = state.routes.find((item) => item.id === handover.transportOrderId)
    const enriched: EscortHandover = { ...handover, version: handover.version ?? route?.currentVersion ?? 1, syncStatus: '待同步' }
    return { ...state, handovers: [enriched, ...state.handovers] }
  }),
  on(RouteActions.syncHandover, (state) => state),
  on(RouteActions.syncHandoverSuccess, (state, { id, confirmedAt }) => ({
    ...state,
    handovers: state.handovers.map((handover) => handover.id === id ? { ...handover, syncStatus: '已同步' as const, confirmedAt } : handover),
  })),
  on(RouteActions.syncHandoverFailure, (state, { id }) => ({
    ...state,
    handovers: state.handovers.map((handover) => handover.id === id ? { ...handover, syncStatus: '同步失败' as const } : handover),
  })),

  // —— 断网交接回网合并：按单号合并，同一区段两边都改各留一版，高危段停住放行 ——
  on(RouteActions.mergeOfflineHandoversSuccess, (state, { handovers: remote }) => {
    const merged = [...state.handovers]
    const conflicts: HandoverConflict[] = []
    for (const remoteHandover of remote) {
      // 幂等：重复回传只算第一次
      if (merged.some((handover) => handover.id === remoteHandover.id)) continue
      const local = merged.find((handover) =>
        handover.transportOrderId === remoteHandover.transportOrderId &&
        handover.sectionId === remoteHandover.sectionId &&
        handover.role === remoteHandover.role,
      )
      if (local) {
        // 同一区段两边都改：各留一版，高危段停住放行
        const section = state.routes
          .find((route) => route.id === remoteHandover.transportOrderId)
          ?.segments.find((segment) => segment.id === remoteHandover.sectionId)
        const releaseBlocked = section?.level === '高'
        conflicts.push({
          transportOrderId: remoteHandover.transportOrderId,
          sectionId: remoteHandover.sectionId,
          localVersion: local.version,
          remoteVersion: remoteHandover.version,
          reason: `同一区段两边都改：本地 v${local.version} 与回传 v${remoteHandover.version} 冲突`,
          releaseBlocked,
        })
        merged.push({ ...remoteHandover, syncStatus: '已同步' })
      } else {
        merged.push({ ...remoteHandover, syncStatus: '已同步' })
      }
    }
    return { ...state, handovers: merged, conflicts }
  }),

  // —— 补传：失败后从未确认处恢复 ——
  on(RouteActions.retryTransmission, (state) => state),
  on(RouteActions.retryAllPending, (state) => state),

  // —— 监护条件 ——
  on(RouteActions.addCondition, (state, { condition }) => ({ ...state, conditions: [condition, ...state.conditions] })),
  on(RouteActions.resolveCondition, (state, { id, status }) => ({ ...state, conditions: state.conditions.map((condition) => condition.id === id ? { ...condition, status } : condition) })),

  // —— 接卸窗口：不足排队写明占用者，两班同时提交只让先到者占用 ——
  on(RouteActions.submitReception, (state, { request }) => {
    const stationWindows = state.windows
      .filter((window) => window.station === request.station)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
    const target = stationWindows.find((window) => window.occupied < window.capacity)
    if (target) {
      const windows = state.windows.map((window) =>
        window.id === target.id
          ? { ...window, occupied: window.occupied + 1, occupant: request.transportOrderId, status: '占用' as const }
          : window,
      )
      const receptionRequests = [{ ...request, status: '已占用' as const, windowId: target.id, occupant: request.transportOrderId }, ...state.receptionRequests]
      return { ...state, windows, receptionRequests }
    }
    // 窗口不足：排队并写明占用者
    const fullest = stationWindows.slice().sort((a, b) => b.occupied - a.occupied)[0]
    const queueEntry: import('../types').QueueEntry = {
      id: `Q-${Date.now().toString().slice(-6)}`,
      windowId: fullest?.id ?? '',
      requestId: request.id,
      position: state.queue.filter((entry) => entry.windowId === fullest?.id).length + 1,
      queuedAt: request.submittedAt,
    }
    const receptionRequests = [{ ...request, status: '排队' as const, occupant: fullest?.occupant || '窗口占用中' }, ...state.receptionRequests]
    const windows = state.windows.map((window) => window.id === fullest?.id ? { ...window, status: '排队中' as const } : window)
    return { ...state, windows, receptionRequests, queue: [...state.queue, queueEntry] }
  }),
  on(RouteActions.assignWindow, (state, { requestId, windowId }) => {
    const windows = state.windows.map((window) => {
      if (window.id !== windowId) return window
      const request = state.receptionRequests.find((item) => item.id === requestId)
      return { ...window, occupied: window.occupied + 1, occupant: request?.transportOrderId ?? window.occupant, status: '占用' as const }
    })
    const receptionRequests = state.receptionRequests.map((request) =>
      request.id === requestId ? { ...request, status: '已占用' as const, windowId, occupant: request.transportOrderId } : request,
    )
    return { ...state, windows, receptionRequests }
  }),
  on(RouteActions.releaseWindow, (state, { requestId }) => {
    const request = state.receptionRequests.find((item) => item.id === requestId)
    const windows = state.windows.map((window) => {
      if (window.id !== request?.windowId) return window
      const occupied = Math.max(0, window.occupied - 1)
      return { ...window, occupied, occupant: occupied > 0 ? window.occupant : '', status: occupied > 0 ? '占用' as const : '空闲' as const }
    })
    const receptionRequests = state.receptionRequests.map((item) => item.id === requestId ? { ...item, status: '已拒绝' as const } : item)
    const queue = state.queue.filter((entry) => entry.requestId !== requestId)
    return { ...state, windows, receptionRequests, queue }
  }),

  on(RouteActions.loadWindows, (state, { windows }) => ({ ...state, windows })),
)
