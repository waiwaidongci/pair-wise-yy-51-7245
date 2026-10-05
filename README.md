# 铁路危险货物运输路径审批与风险复核平台

源提示词编号：8。包含危险货物运输单编组、候选路径生成、MapLibre 路网风险叠加、Turf 里程测算、安全/运营/应急逐区段会签、替代方案与审计基线。

押运交接与运行版本：中间站押运员/调度/接卸站三方交接锚定同一运行版本，审批仍按发车编组放行；押运员或编组变更即升版，相关监护条件与会签失效重算、其余保留依据；接卸窗口不足排队并写明占用者，同时提交先到者占用；断网交接回网按单号合并，同区段两边都改各留一版并停住高危段放行，补传从未确认处恢复、重复回传只计首次；旧数据无运行版本按首版迁移。

## 技术栈

Angular、Angular Material、NgRx、Angular Router、HttpClient、RxJS、MapLibre GL、Turf.js、TypeScript。

## 运行

```bash
npm install
npm run dev
```

开发地址：http://localhost:62051

```bash
npm run build
```
