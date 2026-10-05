import { Component, inject } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { Store } from '@ngrx/store'
import { MatButtonModule } from '@angular/material/button'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatSelectModule } from '@angular/material/select'
import { MatCheckboxModule } from '@angular/material/checkbox'
import { MatDividerModule } from '@angular/material/divider'
import { RouteState } from '../store/route.reducer'
import * as RouteActions from '../store/route.actions'
import type { AuditEntry, HandoverParty, HandoverRecord, ReceiveWindow, ReviewComment, RoutePackage, RunningVersion, SegmentConflict, SupervisionCondition } from '../types'

@Component({
  selector: 'app-handover',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatCheckboxModule, MatDividerModule],
  template: `
    <main class="page" *ngIf="s">
      <div class="page-head">
        <div><p class="eyebrow">中间站三方交接 · 同一运行版本</p><h1>押运交接与版本放行</h1><p>运输单、运行区段与押运交接锚定同一运行版本；审批仍按发车编组放行。</p></div>
        <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>运输单</mat-label><mat-select [ngModel]="s.selectedRouteId" (ngModelChange)="selectOrder($event)">@for (route of s.routes; track route.id) { <mat-option [value]="route.id">{{route.id}} · {{route.trainCode}}</mat-option> }</mat-select></mat-form-field>
      </div>

      @if (haltedSegments.length) {
        <section class="card halt-banner"><b>⚠ 高危段停住放行</b><p>{{haltedSegments.join('、')}} —— 同一区段交接两边都改且冲突未裁决，裁决前该区段不得放行。</p></section>
      }

      <div class="grid-2">
        <section class="card">
          <div class="panel-head"><h2>运行版本 v{{current?.no}}</h2><span class="tag">审批按发车编组放行</span></div>
          <p class="basis">放行依据：发车编组「{{current?.marshalling}}」 · 押运员 {{current?.escort}}</p>
          <p class="muted">中间站三方交接只追加版本记录，不改变放行依据；押运员或编组一变即升版，相关监护条件与会签失效重算。</p>
          <div class="two"><mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>新押运员</mat-label><input matInput [(ngModel)]="escortDraft" placeholder="姓名"></mat-form-field><button mat-stroked-button [disabled]="!escortDraft.trim()" (click)="changeEscort()">押运员变更</button></div>
          <div class="two"><mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>新编组</mat-label><input matInput [(ngModel)]="marshDraft" placeholder="如 26 辆 · 第 3 类罐车编组"></mat-form-field><button mat-stroked-button [disabled]="!marshDraft.trim()" (click)="changeMarshalling()">编组变更</button></div>
          <mat-divider />
          <h3>版本历史</h3>
          @for (v of versions; track v.no) {
            <div class="ver"><b>v{{v.no}}</b><div><span>{{v.escort}} · {{v.marshalling}}</span><small>{{v.createdAt}} · {{v.reason}}</small></div></div>
          }
        </section>

        <section class="card">
          <h2>监护条件与会签</h2>
          <p class="muted">随运行版本失效重算；未受影响的记录保留依据。</p>
          @for (c of conditions; track c.id) {
            <div class="cond" [class.dead]="c.status === '失效重算'"><div><b>{{c.segmentId}} · v{{c.version}}</b><em [class.risk-low]="c.status === '有效'" [class.risk-mid]="c.status === '失效重算'">{{c.status}}</em></div><span>{{c.content}}</span></div>
          }
          <mat-divider />
          <h3>相关会签</h3>
          @for (cm of orderComments; track cm.id) {
            <div class="cond" [class.dead]="cm.status === '失效重算'"><div><b>{{cm.role}} · {{cm.author}} · {{cm.segmentId}}</b><em [class.risk-mid]="cm.status === '失效重算'">{{cm.status}}</em></div><span>{{cm.content}}</span></div>
          } @empty { <p class="muted">本单暂无会签记录。</p> }
        </section>
      </div>

      <div class="grid-2 stack">
        <section class="card">
          <h2>三方交接记录</h2>
          <p class="muted">列车到中间站后，押运员、调度、接卸站各记一份，均锚定同一运行版本。</p>
          @for (p of parties; track p) {
            <h3>{{p}}</h3>
            @for (h of handoversOf(p); track h.id) {
              <div class="ho" [class.conflicted]="h.status === '冲突保留'">
                <div class="ho-head"><b>{{h.station}} · {{h.segmentId}}</b><span class="tag">v{{h.version}}</span>@if (h.offline) { <span class="tag off">断网</span> }<em [class.risk-low]="h.status === '已确认'" [class.risk-mid]="h.status !== '已确认'">{{h.status}}</em></div>
                <p>{{h.content}}</p>
                <small>{{h.author}} · {{h.submittedAt}} · {{h.id}}</small>
                @if (h.status === '待确认' && !h.offline) { <button mat-button color="primary" (click)="confirm(h.id)">确认</button> }
              </div>
            } @empty { <p class="muted">暂无{{p}}交接记录。</p> }
          }
          <mat-divider />
          <h3>登记交接</h3>
          <div class="two">
            <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>记录方</mat-label><mat-select [(ngModel)]="party">@for (p of parties; track p) { <mat-option [value]="p">{{p}}</mat-option> }</mat-select></mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>运行区段（中间站）</mat-label><mat-select [(ngModel)]="segmentId">@for (seg of order?.segments ?? []; track seg.id) { <mat-option [value]="seg.id">{{seg.id}} · 到 {{seg.to}}</mat-option> }</mat-select></mat-form-field>
          </div>
          <mat-form-field class="wide" appearance="outline" subscriptSizing="dynamic"><mat-label>交接内容</mat-label><textarea matInput rows="3" [(ngModel)]="content" placeholder="罐体状态、到开时刻、接卸条件等"></textarea></mat-form-field>
          <div class="row"><mat-checkbox [(ngModel)]="offline">断网登记（本地暂存，回网后按单号合并）</mat-checkbox><span class="spacer"></span><button mat-flat-button color="primary" [disabled]="!content.trim()" (click)="addHandover()">提交交接</button></div>
        </section>

        <section class="card">
          <h2>接卸窗口</h2>
          <p class="muted">窗口不足排队并写明占用者；两班同时提交接车，只让先到者占用。</p>
          @for (w of s.receiveWindows; track w.id) {
            <div class="win">
              <div class="ho-head"><b>{{w.station}}（{{w.segmentId}}）</b><span class="tag">容量 {{w.occupants.length}}/{{w.capacity}}</span></div>
              @for (o of w.occupants; track o.seq) { <p class="occ">占用者：{{o.orderId}} · {{o.shift}} · {{o.submittedAt}}</p> }
              @for (q of w.queue; track q.seq) { <p class="que">排队：{{q.orderId}} · {{q.shift}} · {{q.submittedAt}} —— 等待占用者 {{w.occupants[0]?.orderId}} 释放</p> }
              @if (!w.occupants.length) { <p class="muted">窗口空闲</p> }
              <div class="row">
                <button mat-stroked-button (click)="submitReceive(w, '白班')">白班提交接车</button>
                <button mat-stroked-button (click)="submitReceive(w, '夜班')">夜班提交接车</button>
                <span class="spacer"></span>
                <button mat-button color="warn" [disabled]="!w.occupants.length" (click)="release(w)">释放窗口</button>
              </div>
            </div>
          }
        </section>
      </div>

      <div class="grid-2 stack">
        <section class="card">
          <div class="panel-head"><h2>断网回传与合并</h2><button mat-flat-button color="primary" (click)="sync()">回网合并（按单号）</button></div>
          @for (b of s.syncBatches; track b.id) {
            <div class="batch">
              <div class="ho-head"><b>{{b.id}} · {{b.orderId}}</b><em [class.risk-low]="b.status === '已确认'" [class.risk-mid]="b.status !== '已确认'">{{b.status}}</em></div>
              <small>已确认 {{b.confirmedIds.length}}/{{b.recordIds.length}} · 补传尝试 {{b.attempts}} 次</small>
              <div class="row">
                @if (b.status !== '已确认') { <button mat-stroked-button (click)="retry(b.id)">补传（从未确认处恢复）</button> }
                @else { <button mat-stroked-button (click)="retry(b.id)">再次回传（去重）</button> }
              </div>
            </div>
          }
          @if (s.conflicts.length) {
            <h3>区段冲突（各留一版）</h3>
            @for (c of s.conflicts; track c.segmentId) {
              <div class="conflict-box">
                <b>{{c.orderId}} · {{c.segmentId}} 两边都改</b>
                <p><span class="tag">本端</span> {{recordOf(c.localId)?.content}}</p>
                <p><span class="tag off">回传</span> {{recordOf(c.remoteId)?.content}}</p>
                <div class="row"><button mat-stroked-button (click)="resolve(c, 'local')">采用本端版</button><button mat-stroked-button (click)="resolve(c, 'remote')">采用回传版</button></div>
              </div>
            }
          }
        </section>

        <section class="card">
          <h2>审计时间线</h2>
          <div class="timeline">
            @for (a of auditLog; track $index) { <div class="log"><b>{{a.at}}</b><p>{{a.text}}</p></div> }
          </div>
        </section>
      </div>
    </main>
  `,
  styles: [`
    h2,h3{margin:0 0 10px}h3{margin-top:14px}.muted{color:#7a8798;font-size:12px;margin:4px 0 10px}.basis{font-weight:600;color:#182230 !important;margin:6px 0}
    .panel-head{display:flex;justify-content:space-between;align-items:center;gap:10px}
    .tag{display:inline-block;background:#eff6ff;color:#2563eb;border-radius:4px;padding:1px 8px;font-size:12px;font-weight:600}
    .tag.off{background:#fef3c7;color:#b45309}
    .two{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;margin:6px 0}.wide{width:100%}
    .row{display:flex;gap:10px;align-items:center;margin-top:8px;flex-wrap:wrap}
    .ver{display:flex;gap:12px;padding:9px 0;border-bottom:1px solid #edf0f5}.ver b{min-width:32px}.ver span,.ver small{display:block}.ver small{color:#7a8798;margin-top:2px}
    .cond{padding:9px 0;border-bottom:1px solid #edf0f5}.cond>div{display:flex;justify-content:space-between;gap:10px}.cond span{display:block;color:#475569;font-size:13px;margin-top:3px}.cond em{font-style:normal;font-size:12px;font-weight:700}
    .dead{opacity:.55}.dead span{text-decoration:line-through}
    .ho,.win,.batch{border:1px solid #e1e7ef;border-radius:6px;padding:10px 12px;margin:8px 0}
    .ho.conflicted{border-color:#f59e0b;background:#fffbeb}
    .ho-head{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.ho-head em{font-style:normal;font-size:12px;font-weight:700;margin-left:auto}
    .ho p{margin:6px 0;color:#475569}.ho small{color:#7a8798}
    .occ{color:#15803d;margin:6px 0;font-weight:600}.que{color:#b45309;margin:6px 0}
    .batch small{color:#7a8798;display:block;margin-top:4px}
    .conflict-box{border:1px solid #f59e0b;background:#fffbeb;border-radius:6px;padding:10px 12px;margin:8px 0}.conflict-box p{margin:6px 0;color:#475569}
    .halt-banner{border-left:4px solid #dc2626;margin-bottom:16px}.halt-banner b{color:#dc2626}
    .timeline{max-height:460px;overflow:auto}.log{padding:9px 0;border-bottom:1px solid #edf0f5}.log b{font-size:13px}.log p{margin:3px 0 0;color:#475569;font-size:13px}
    .stack{margin-top:16px}
    @media(max-width:620px){.two{grid-template-columns:1fr}}
  `],
})
export class HandoverComponent {
  private readonly store = inject(Store<{ routes: RouteState }>)
  s!: RouteState
  readonly parties: HandoverParty[] = ['押运员', '调度', '接卸站']
  party: HandoverParty = '押运员'
  segmentId = ''
  content = ''
  offline = false
  escortDraft = ''
  marshDraft = ''

  constructor() {
    this.store.select('routes').subscribe((state) => {
      this.s = state
      const order = this.order
      if (order && !order.segments.some((segment) => segment.id === this.segmentId)) this.segmentId = order.segments[0]?.id ?? ''
    })
  }

  get order(): RoutePackage | undefined { return this.s?.routes.find((route) => route.id === this.s.selectedRouteId) }
  get versions(): RunningVersion[] { return [...(this.s?.runningVersions[this.s.selectedRouteId] ?? [])].reverse() }
  get current(): RunningVersion | undefined { return this.versions[0] }
  get conditions(): SupervisionCondition[] { return this.s?.conditions.filter((item) => item.orderId === this.s.selectedRouteId) ?? [] }
  get orderComments(): ReviewComment[] { return this.s?.comments.filter((item) => item.orderId === this.s.selectedRouteId) ?? [] }
  get auditLog(): AuditEntry[] { return [...(this.s?.audit ?? [])].reverse() }
  get haltedSegments(): string[] {
    return (this.s?.haltedSegmentIds ?? []).map((id) => {
      const segment = this.s.routes.flatMap((route) => route.segments).find((item) => item.id === id)
      return segment ? `${segment.id} ${segment.name}` : id
    })
  }

  handoversOf(party: HandoverParty): HandoverRecord[] { return this.s.handovers.filter((item) => item.orderId === this.s.selectedRouteId && item.party === party) }
  recordOf(id: string): HandoverRecord | undefined { return this.s.handovers.find((item) => item.id === id) }

  selectOrder(id: string) { this.store.dispatch(RouteActions.selectRoute({ id })) }
  addHandover() {
    const order = this.order
    if (!order || !this.content.trim()) return
    const segment = order.segments.find((item) => item.id === this.segmentId)
    const stamp = Date.now().toString().slice(-5)
    const at = this.now()
    this.store.dispatch(RouteActions.recordHandover({
      record: { id: `HO-${stamp}`, orderId: order.id, segmentId: this.segmentId, station: segment?.to ?? '', party: this.party, author: this.party === '押运员' ? this.current?.escort ?? '押运员' : '值班员', content: this.content.trim(), version: 1, offline: this.offline, submittedAt: at, status: '待确认' },
      batchId: `B-${stamp}`,
      at,
    }))
    this.content = ''
    this.offline = false
  }
  confirm(id: string) { this.store.dispatch(RouteActions.confirmHandover({ id, at: this.now() })) }
  changeEscort() { if (!this.order || !this.escortDraft.trim()) return; this.store.dispatch(RouteActions.changeEscort({ orderId: this.order.id, escort: this.escortDraft.trim(), at: this.now() })); this.escortDraft = '' }
  changeMarshalling() { if (!this.order || !this.marshDraft.trim()) return; this.store.dispatch(RouteActions.changeMarshalling({ orderId: this.order.id, marshalling: this.marshDraft.trim(), at: this.now() })); this.marshDraft = '' }
  submitReceive(window: ReceiveWindow, shift: string) { if (!this.order) return; this.store.dispatch(RouteActions.submitReceive({ windowId: window.id, orderId: this.order.id, shift, at: this.now() })) }
  release(window: ReceiveWindow) { this.store.dispatch(RouteActions.releaseReceiveWindow({ windowId: window.id, at: this.now() })) }
  sync() { this.store.dispatch(RouteActions.syncOffline({ at: this.now() })) }
  retry(batchId: string) { this.store.dispatch(RouteActions.retryBatch({ batchId, at: this.now() })) }
  resolve(conflict: SegmentConflict, keep: 'local' | 'remote') { this.store.dispatch(RouteActions.resolveConflict({ orderId: conflict.orderId, segmentId: conflict.segmentId, keep, at: this.now() })) }

  private now(): string {
    const date = new Date()
    const pad = (value: number) => String(value).padStart(2, '0')
    return `今天 ${pad(date.getHours())}:${pad(date.getMinutes())}`
  }
}
