import { Component, inject } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { Store } from '@ngrx/store'
import { MatButtonModule } from '@angular/material/button'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatSelectModule } from '@angular/material/select'
import { MatInputModule } from '@angular/material/input'
import { MatTabsModule } from '@angular/material/tabs'
import { MatProgressBarModule } from '@angular/material/progress-bar'
import { MatChipsModule } from '@angular/material/chips'
import { MatDividerModule } from '@angular/material/divider'
import { MatIconModule } from '@angular/material/icon'
import { RouteState } from '../store/route.reducer'
import * as RouteActions from '../store/route.actions'
import type { ConditionRelation, EscortHandover, HandoverRole, ReceptionRequest, RoutePackage } from '../types'

@Component({
  selector: 'app-handover',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatFormFieldModule, MatSelectModule, MatInputModule, MatTabsModule, MatProgressBarModule, MatChipsModule, MatDividerModule, MatIconModule],
  template: `
    <main class="page">
      <div class="page-head">
        <div><p class="eyebrow">运行版本 · 押运交接 · 接卸窗口</p><h1>运行交接与版本协同</h1><p>运输单、运行区段、押运交接共用同一运行版本；押运员或编组一变，相关监护条件与会签失效重算。</p></div>
        <div><button mat-stroked-button (click)="mergeOffline()">断网回网合并</button> <button mat-flat-button color="primary" (click)="retryAll()">补传全部失败</button></div>
      </div>

      @if ((state$ | async)?.loading) { <mat-progress-bar mode="indeterminate" /> }

      <mat-tab-group>
        <mat-tab label="运行版本">
          <section class="card">
            <h2>运输单运行版本</h2>
            <p class="hint">审批按发车编组放行；押运员或编组变更即升级运行版本，相关监护条件与会签失效重算，其余保留依据。</p>
            @for (route of (state$ | async)?.routes || []; track route.id) {
              <div class="version-row">
                <div class="version-main">
                  <b>{{ route.id }}</b>
                  <small>{{ route.origin }} → {{ route.destination }} · {{ route.trainCode }} · 押运员 {{ route.escort || '待指定' }}</small>
                  <small class="basis">发车编组（审批依据）：{{ route.departureFormation || route.trainCode }} · 当前运行版本 v{{ route.currentVersion ?? 1 }}</small>
                </div>
                <div class="version-actions">
                  <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>押运员</mat-label><input matInput [(ngModel)]="escortDrafts[route.id]" placeholder="新押运员"></mat-form-field>
                  <button mat-stroked-button (click)="changeEscort(route)">变更押运员</button>
                  <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>编组</mat-label><input matInput [(ngModel)]="formationDrafts[route.id]" placeholder="新编组"></mat-form-field>
                  <button mat-stroked-button (click)="changeFormation(route)">变更编组</button>
                </div>
              </div>
            }
          </section>

          <section class="card">
            <h2>版本变更记录</h2>
            @for (version of (state$ | async)?.runningVersions || []; track version.transportOrderId + version.version) {
              <div class="timeline-row"><b>v{{ version.version }}</b><span>{{ version.transportOrderId }} · {{ version.formation }} · {{ version.escort }}</span><small>{{ version.reason }} · 依据：{{ version.basis }}</small></div>
            }
          </section>
        </mat-tab>

        <mat-tab label="押运交接">
          <section class="card">
            <h2>记录交接（到中间站后三方各记一份）</h2>
            <div class="form-grid">
              <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>运输单</mat-label><mat-select [(ngModel)]="handoverOrderId"><mat-option *ngFor="let route of (state$ | async)?.routes || []" [value]="route.id">{{ route.id }} · {{ route.trainCode }}</mat-option></mat-select></mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>区段</mat-label><mat-select [(ngModel)]="handoverSectionId"><mat-option *ngFor="let segment of segmentsOf(handoverOrderId)" [value]="segment.id">{{ segment.id }} · {{ segment.name }}</mat-option></mat-select></mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>中间站</mat-label><input matInput [(ngModel)]="handoverStation" placeholder="如 天水"></mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>交接方</mat-label><mat-select [(ngModel)]="handoverRole"><mat-option value="押运员">押运员</mat-option><mat-option value="调度">调度</mat-option><mat-option value="接卸站">接卸站</mat-option></mat-select></mat-form-field>
            </div>
            <mat-form-field class="wide" appearance="outline" subscriptSizing="dynamic"><mat-label>交接内容</mat-label><textarea matInput rows="2" [(ngModel)]="handoverContent" placeholder="押运状态、编组、接卸准备等"></textarea></mat-form-field>
            <button mat-flat-button color="primary" (click)="recordHandover()" [disabled]="!handoverOrderId || !handoverSectionId || !handoverContent.trim()">记录交接</button>
          </section>

          <section class="card">
            <h2>交接记录</h2>
            @for (handover of (state$ | async)?.handovers || []; track handover.id) {
              <div class="handover-row">
                <div class="handover-main">
                  <b>{{ handover.role }} · {{ handover.operator }}</b>
                  <small>{{ handover.transportOrderId }} · {{ handover.sectionId }} · {{ handover.station }} · v{{ handover.version }}</small>
                  <small>{{ handover.content }}</small>
                </div>
                <div class="handover-side">
                  <mat-chip [class]="syncClass(handover.syncStatus)">{{ handover.syncStatus }}</mat-chip>
                  @if (handover.syncStatus === '同步失败' || handover.syncStatus === '未确认') {
                    <button mat-stroked-button color="warn" (click)="retry(handover.id)">补传</button>
                  } @else if (handover.syncStatus === '待同步') {
                    <button mat-stroked-button (click)="sync(handover.id)">同步</button>
                  }
                </div>
              </div>
            }
          </section>
        </mat-tab>

        <mat-tab label="条件会签">
          <section class="card">
            <h2>监护条件</h2>
            <p class="hint">押运员或编组变更后，相关条件失效重算；其余保留依据。</p>
            @for (condition of (state$ | async)?.conditions || []; track condition.id) {
              <div class="condition-row" [class]="'status-' + condition.status">
                <div class="condition-main">
                  <b>{{ condition.content }}</b>
                  <small>{{ condition.transportOrderId }} · {{ condition.sectionId }} · v{{ condition.version }} · 相关方：{{ condition.relatesTo }}</small>
                  <small class="basis">依据：{{ condition.basis }}</small>
                </div>
                <div class="condition-side">
                  <mat-chip [class]="'chip-' + condition.status">{{ condition.status }}</mat-chip>
                  @if (condition.status === '失效') { <button mat-stroked-button color="primary" (click)="recalculate(condition.transportOrderId)">重算</button> }
                </div>
              </div>
            }
          </section>

          <section class="card">
            <h2>会签意见</h2>
            @for (comment of (state$ | async)?.comments || []; track comment.id) {
              <div class="comment-row" [class]="'status-' + comment.status">
                <div class="comment-main">
                  <b>{{ comment.role }} · {{ comment.author }}</b>
                  <small>{{ comment.segmentId }} · v{{ comment.version ?? 1 }} · 相关方：{{ comment.relatesTo ?? '其他' }}</small>
                  <small>{{ comment.content }}</small>
                  @if (comment.basis) { <small class="basis">依据：{{ comment.basis }}</small> }
                </div>
                <mat-chip [class]="'chip-' + comment.status">{{ comment.status }}</mat-chip>
              </div>
            }
          </section>
        </mat-tab>

        <mat-tab label="接卸窗口">
          <section class="card">
            <h2>接车申请（两班同时提交只让先到者占用）</h2>
            <div class="form-grid">
              <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>运输单</mat-label><mat-select [(ngModel)]="receptionOrderId"><mat-option *ngFor="let route of (state$ | async)?.routes || []" [value]="route.id">{{ route.id }}</mat-option></mat-select></mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>车站</mat-label><input matInput [(ngModel)]="receptionStation" placeholder="如 郑州北"></mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>班次</mat-label><input matInput [(ngModel)]="receptionShift" placeholder="如 白班/夜班"></mat-form-field>
            </div>
            <button mat-flat-button color="primary" (click)="submitReception()" [disabled]="!receptionOrderId || !receptionStation || !receptionShift">提交接车</button>
          </section>

          <section class="card">
            <h2>窗口占用</h2>
            @for (window of (state$ | async)?.windows || []; track window.id) {
              <div class="window-row">
                <div class="window-main">
                  <b>{{ window.station }} · {{ window.startTime }}-{{ window.endTime }}</b>
                  <small>容量 {{ window.capacity }} · 占用 {{ window.occupied }} · 占用者 {{ window.occupant || '无' }}</small>
                </div>
                <mat-chip [class]="'chip-' + window.status">{{ window.status }}</mat-chip>
              </div>
            }
          </section>

          <section class="card">
            <h2>排队记录</h2>
            @for (entry of (state$ | async)?.queue || []; track entry.id) {
              <div class="queue-row"><b>第 {{ entry.position }} 位</b><small>窗口 {{ entry.windowId }} · 申请 {{ entry.requestId }} · {{ entry.queuedAt }}</small></div>
            } @empty { <p class="hint">暂无排队</p> }
          </section>

          <section class="card">
            <h2>接车申请记录</h2>
            @for (request of (state$ | async)?.receptionRequests || []; track request.id) {
              <div class="request-row">
                <div class="request-main">
                  <b>{{ request.transportOrderId }} · {{ request.shift }}</b>
                  <small>{{ request.station }} · {{ request.submittedAt }} · 占用者 {{ request.occupant || '无' }}</small>
                </div>
                <div class="request-side">
                  <mat-chip [class]="'chip-' + request.status">{{ request.status }}</mat-chip>
                  @if (request.status === '已占用') { <button mat-stroked-button (click)="release(request.id)">释放</button> }
                </div>
              </div>
            }
          </section>
        </mat-tab>

        <mat-tab label="断网同步">
          <section class="card">
            <h2>断网交接合并</h2>
            <p class="hint">断网期间交接本地记录，回网后按单号合并；同一区段两边都改则各留一版，高危段停住放行。重复回传只算第一次。</p>
            <button mat-flat-button color="primary" (click)="mergeOffline()">回网合并远端交接</button>
          </section>

          <section class="card">
            <h2>合并冲突（同一区段两边都改）</h2>
            @for (conflict of (state$ | async)?.conflicts || []; track conflict.transportOrderId + conflict.sectionId) {
              <div class="conflict-row" [class.blocked]="conflict.releaseBlocked">
                <b>{{ conflict.transportOrderId }} · {{ conflict.sectionId }}</b>
                <small>{{ conflict.reason }}</small>
                @if (conflict.releaseBlocked) { <mat-chip class="chip-blocked">高危段停住放行</mat-chip> }
              </div>
            } @empty { <p class="hint">暂无冲突</p> }
          </section>

          <section class="card">
            <h2>补传</h2>
            <p class="hint">补传失败后从未确认处恢复；重复回传只算第一次。</p>
            <button mat-stroked-button color="primary" (click)="retryAll()">补传全部失败交接</button>
          </section>
        </mat-tab>
      </mat-tab-group>
    </main>
  `,
  styles: [`
    h2{margin:0 0 12px;font-size:18px}.hint{color:#667085;font-size:13px;margin:0 0 14px}.wide{width:100%}
    .form-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:12px}
    .version-row{display:flex;justify-content:space-between;gap:16px;padding:14px 0;border-bottom:1px solid #edf0f5;flex-wrap:wrap}
    .version-main{display:flex;flex-direction:column;gap:3px;min-width:260px}.version-main small{color:#667085;font-size:12px}.basis{color:#2563eb!important}
    .version-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.version-actions mat-form-field{width:130px}
    .timeline-row{display:flex;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid #edf0f5;flex-wrap:wrap}.timeline-row small{color:#667085;font-size:12px}
    .handover-row,.condition-row,.comment-row,.window-row,.queue-row,.request-row,.conflict-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #edf0f5;flex-wrap:wrap}
    .handover-main,.condition-main,.comment-main,.window-main,.request-main{display:flex;flex-direction:column;gap:3px;flex:1;min-width:220px}.handover-main small,.condition-main small,.comment-main small,.window-main small,.request-main small{color:#667085;font-size:12px}
    .handover-side,.condition-side,.request-side{display:flex;gap:8px;align-items:center}
    .status-失效{background:#fef2f2}.status-重算中{background:#fffbeb}.status-已接受{background:#f0fdf4}
    .conflict-row{flex-direction:column;align-items:flex-start;gap:4px}.conflict-row.blocked{background:#fef2f2;border-left:4px solid #dc2626;padding-left:12px}
    mat-chip{font-size:12px}.chip-已同步{background:#dcfce7;color:#15803d}.chip-待同步{background:#fef9c3;color:#a16207}.chip-同步失败{background:#fee2e2;color:#dc2626}.chip-未确认{background:#f1f5f9;color:#64748b}
    .chip-有效{background:#dcfce7;color:#15803d}.chip-失效{background:#fee2e2;color:#dc2626}.chip-重算中{background:#fef9c3;color:#a16207}
    .chip-待确认{background:#f1f5f9;color:#64748b}.chip-已接受{background:#dcfce7;color:#15803d}.chip-已退回{background:#fee2e2;color:#dc2626}
    .chip-空闲{background:#f1f5f9;color:#64748b}.chip-占用{background:#dbeafe;color:#1d4ed8}.chip-排队中{background:#fef9c3;color:#a16207}
    .chip-待处理{background:#f1f5f9;color:#64748b}.chip-已占用{background:#dbeafe;color:#1d4ed8}.chip-排队{background:#fef9c3;color:#a16207}.chip-已拒绝{background:#fee2e2;color:#dc2626}
    .chip-blocked{background:#dc2626;color:#fff}
    @media(max-width:720px){.form-grid{grid-template-columns:1fr}}
  `],
})
export class HandoverComponent {
  private readonly store = inject(Store<{ routes: RouteState }>)
  readonly state$ = this.store.select('routes')

  escortDrafts: Record<string, string> = {}
  formationDrafts: Record<string, string> = {}

  handoverOrderId = ''
  handoverSectionId = ''
  handoverStation = ''
  handoverRole: HandoverRole = '押运员'
  handoverContent = ''

  receptionOrderId = ''
  receptionStation = ''
  receptionShift = ''

  segmentsOf(orderId: string): RoutePackage['segments'] {
    let segments: RoutePackage['segments'] = []
    this.state$.subscribe((state: RouteState) => {
      segments = state.routes.find((route: RoutePackage) => route.id === orderId)?.segments ?? []
    }).unsubscribe()
    return segments
  }

  changeEscort(route: RoutePackage) {
    const escort = this.escortDrafts[route.id]?.trim()
    if (!escort) return
    this.store.dispatch(RouteActions.changeEscort({ orderId: route.id, escort, reason: '押运员变更' }))
    this.escortDrafts[route.id] = ''
  }

  changeFormation(route: RoutePackage) {
    const formation = this.formationDrafts[route.id]?.trim()
    if (!formation) return
    this.store.dispatch(RouteActions.changeFormation({ orderId: route.id, formation, reason: '编组变更' }))
    this.formationDrafts[route.id] = ''
  }

  recordHandover() {
    const handover: EscortHandover = {
      id: `HO-${Date.now().toString().slice(-6)}`,
      transportOrderId: this.handoverOrderId,
      sectionId: this.handoverSectionId,
      station: this.handoverStation,
      role: this.handoverRole,
      operator: '当前记录人',
      content: this.handoverContent,
      recordedAt: '刚刚',
      version: 1,
      syncStatus: '待同步',
    }
    this.store.dispatch(RouteActions.recordHandover({ handover }))
    this.handoverContent = ''
  }

  sync(id: string) { this.store.dispatch(RouteActions.syncHandover({ id })) }
  retry(id: string) { this.store.dispatch(RouteActions.retryTransmission({ id })) }
  retryAll() { this.store.dispatch(RouteActions.retryAllPending()) }
  mergeOffline() { this.store.dispatch(RouteActions.mergeOfflineHandovers()) }
  recalculate(orderId: string) { this.store.dispatch(RouteActions.recalculateConditions({ orderId })) }

  submitReception() {
    const request: ReceptionRequest = {
      id: `RR-${Date.now().toString().slice(-6)}`,
      transportOrderId: this.receptionOrderId,
      station: this.receptionStation,
      shift: this.receptionShift,
      submittedAt: '刚刚',
      status: '待处理',
    }
    this.store.dispatch(RouteActions.submitReception({ request }))
    this.receptionShift = ''
  }

  release(requestId: string) { this.store.dispatch(RouteActions.releaseWindow({ requestId })) }

  syncClass(status: string) { return `chip-${status}` }
}
