import { inject, Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { delay, map, of } from 'rxjs'
import type { EscortHandover, RoutePackage } from '../types'

@Injectable({ providedIn: 'root' })
export class RouteApiService {
  private readonly http = inject(HttpClient)

  getRoutePackages() {
    return this.http.get<{ items: RoutePackage[] }>('route-data.json').pipe(map((response) => response.items))
  }

  /** 同步交接：模拟回传，成功返回确认时间 */
  syncHandover(id: string) {
    return of(`${id} @ ${new Date().toTimeString().slice(0, 8)}`).pipe(delay(500))
  }

  /** 断网恢复后拉取远端交接，含同一区段两边都改的冲突用例 */
  getRemoteHandovers() {
    const remote: EscortHandover[] = [
      { id: 'HO-R-101', transportOrderId: 'HG-260929-018', sectionId: 'S-203', station: '天水', role: '押运员', operator: '远端押运', content: '远端回传：运行正常，准备进入水源地段', recordedAt: '今天 10:31', version: 1, syncStatus: '待同步' },
      { id: 'HO-R-102', transportOrderId: 'HG-260930-006', sectionId: 'S-304', station: '三门峡西', role: '调度', operator: '远端调度', content: '远端回传：编组正确，具备运行条件', recordedAt: '今天 11:00', version: 1, syncStatus: '待同步' },
    ]
    return of(remote).pipe(delay(800))
  }
}
