import { inject, Injectable } from '@angular/core'
import { Actions, createEffect, ofType } from '@ngrx/effects'
import { Store } from '@ngrx/store'
import { catchError, delay, map, mergeMap, of, switchMap, withLatestFrom } from 'rxjs'
import { RouteApiService } from '../services/route-api.service'
import type { EscortHandover } from '../types'
import * as RouteActions from './route.actions'
import { RouteState } from './route.reducer'

@Injectable()
export class RouteEffects {
  private readonly actions$ = inject(Actions)
  private readonly api = inject(RouteApiService)
  private readonly store = inject(Store<{ routes: RouteState }>)

  loadRoutes$ = createEffect(() => this.actions$.pipe(
    ofType(RouteActions.loadRoutes),
    switchMap(() => this.api.getRoutePackages().pipe(
      map((routes) => RouteActions.loadRoutesSuccess({ routes })),
      catchError((error: unknown) => of(RouteActions.loadRoutesFailure({ error: error instanceof Error ? error.message : '无法读取路径数据' }))),
    )),
  ))

  // 同步交接：模拟回传，成功确认或失败
  syncHandover$ = createEffect(() => this.actions$.pipe(
    ofType(RouteActions.syncHandover),
    switchMap(({ id }) => this.api.syncHandover(id).pipe(
      map((confirmedAt) => RouteActions.syncHandoverSuccess({ id, confirmedAt })),
      catchError(() => of(RouteActions.syncHandoverFailure({ id }))),
    )),
  ))

  // 断网交接回网：拉取远端交接并按单号合并
  mergeOfflineHandovers$ = createEffect(() => this.actions$.pipe(
    ofType(RouteActions.mergeOfflineHandovers),
    switchMap(() => this.api.getRemoteHandovers().pipe(
      map((handovers) => RouteActions.mergeOfflineHandoversSuccess({ handovers })),
      catchError(() => of(RouteActions.mergeOfflineHandoversSuccess({ handovers: [] }))),
    )),
  ))

  // 补传：失败后从未确认处恢复
  retryTransmission$ = createEffect(() => this.actions$.pipe(
    ofType(RouteActions.retryTransmission),
    switchMap(({ id }) => this.api.syncHandover(id).pipe(
      map((confirmedAt) => RouteActions.syncHandoverSuccess({ id, confirmedAt })),
      catchError(() => of(RouteActions.syncHandoverFailure({ id }))),
    )),
  ))

  // 失效重算：延迟后完成重算
  recalculateConditions$ = createEffect(() => this.actions$.pipe(
    ofType(RouteActions.recalculateConditions),
    delay(600),
    map(({ orderId }) => RouteActions.recalculateConditionsSuccess({ orderId })),
  ))

  // 补传全部失败：从未确认处恢复，逐个重试
  retryAllPending$ = createEffect(() => this.actions$.pipe(
    ofType(RouteActions.retryAllPending),
    withLatestFrom(this.store.select('routes')),
    mergeMap(([, state]: [unknown, RouteState]) => {
      const pending: EscortHandover[] = state.handovers.filter((h: EscortHandover) => h.syncStatus === '同步失败' || h.syncStatus === '未确认')
      return pending.map((h: EscortHandover) => RouteActions.retryTransmission({ id: h.id }))
    }),
  ))
}
