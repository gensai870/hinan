import { useState, useEffect, useCallback } from "react";

// ── Supabase設定 ─────────────────────────────────────
const SUPA_URL  = "https://fuggbtoovpjqwudiqkvq.supabase.co";
const SUPA_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1Z2didG9vdnBqcXd1ZGlxa3ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5ODk0NTYsImV4cCI6MjA5NjU2NTQ1Nn0.gQj6mefELZm-pzNyNDNhEq0yL2p2AkAqg5H7XSIVLWI";

async function supaFetch(path, opts = {}) {
  const res = await fetch(`${SUPA_URL}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPA_KEY,
      "Authorization": `Bearer ${opts.token || SUPA_KEY}`,
      ...(opts.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.message || JSON.stringify(data));
  return data;
}

// ── デフォルト値 ──────────────────────────────────────
const DEFAULT_ROLES = [
  { role: "統括・指揮", name: "" },
  { role: "避難誘導",   name: "" },
  { role: "安否確認・点呼", name: "" },
  { role: "要配慮者専任", name: "" },
];
const DEFAULT_TL = [
  { time: "9:00",  content: "集合・オリエンテーション（目的・シナリオ説明）", actor: "全員" },
  { time: "9:15",  content: "第一次災害発生（警報発令）",                     actor: "統括" },
  { time: "9:16",  content: "初期対応・安全確保行動（自己判断で開始）",        actor: "各自" },
  { time: "9:20",  content: "避難誘導・要配慮者対応・二次避難判断",            actor: "誘導班" },
  { time: "9:30",  content: "一次避難完了・点呼・安否確認",                    actor: "安否班" },
  { time: "9:40",  content: "訓練終了宣言・講評",                              actor: "統括" },
  { time: "9:45",  content: "振り返りワーク・アンケート記入",                  actor: "全員" },
];
const BLANK_FORM = {
  orgName:"", drillDate:"", drillTime:"", orgType:"", drillNum:"", pcount:"", resp:"",
  d1:"", d2:[], scenario:"", bias:[],
  vuln:[], vRatio:"", powerOut:"",
  roles: DEFAULT_ROLES, backup:"", ext:[],
  timeline: DEFAULT_TL, ev1:"", ev2:"", routeNote:"",
  kpis:[], targetT:"", prevT:"", debrief:"", prevIssue:"", behavior:"",
};
const ROLE_OPTIONS = ["統括・指揮","避難誘導","安否確認・点呼","初期消火","救護・応急手当","情報収集・発信","要配慮者専任","保護者対応・引き渡し","記録・評価","外部機関対応","その他"];
const STEPS = ["基本情報","複合災害","要配慮者","役割分担","タイムライン","評価・PDCA","確認"];

// ── 小コンポーネント ──────────────────────────────────
const Tag = ({ label, selected, onClick }) => (
  <button onClick={onClick}
    className={`px-3 py-1.5 rounded-full border text-sm transition-all ${
      selected ? "border-sky-500 bg-sky-50 text-sky-700 font-medium"
               : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
    {label}
  </button>
);

const ChkCard = ({ label, sub, checked, onChange }) => (
  <label className={`flex gap-2 p-2.5 rounded-lg border cursor-pointer transition-all text-sm leading-snug ${
    checked ? "border-sky-400 bg-sky-50 text-sky-700" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
    <input type="checkbox" checked={checked} onChange={onChange} className="mt-0.5 flex-shrink-0 accent-sky-500" />
    <span>{label}{sub && <span className="block text-xs opacity-60 mt-0.5">{sub}</span>}</span>
  </label>
);

const Fld = ({ label, required, hint, children }) => (
  <div className="mb-4">
    <label className="block text-xs text-gray-500 mb-1.5">
      {label}{required && <span className="text-red-400 ml-1">*</span>}
    </label>
    {children}
    {hint && <p className="text-xs text-gray-400 mt-1 leading-relaxed">{hint}</p>}
  </div>
);

const Inp = (p) => <input {...p} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-sky-400 transition-colors" />;
const Tx  = (p) => <textarea {...p} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-sky-400 resize-y min-h-[60px] leading-relaxed" />;
const Sl  = ({ options, ...p }) => (
  <select {...p} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-sky-400">
    {options.map(o => <option key={o}>{o}</option>)}
  </select>
);

const Note = ({ children }) => (
  <div className="border-l-2 border-sky-400 bg-sky-50 rounded-r-lg px-3 py-2.5 text-sm text-gray-600 leading-relaxed mb-4">
    {children}
  </div>
);

const Spinner = () => (
  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
  </svg>
);



// ── ファイルエクスポート関数 ──────────────────────────

function buildDocText(form) {
  const roles = form.roles.filter(r=>r.name).map(r=>`${r.role}：${r.name}`).join("\n");
  const tl = form.timeline.filter(t=>t.time&&t.content)
    .map(t=>`  ${t.time}  ${t.content}${t.actor?`（${t.actor}）`:""}`).join("\n");
  const d = form.drillDate ? form.drillDate.replace(/-/g,"/") : "未入力";
  return `避難訓練計画書
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
powered by 減災教育普及協会

【1. 基本情報】
組織名　　　：${form.orgName || "未入力"}
訓練日　　　：${d}　${form.drillTime || ""}
組織種別　　：${form.orgType || "未入力"}
実施回数　　：${form.drillNum || "未入力"}
参加人数　　：${form.pcount ? form.pcount+"名" : "未入力"}
訓練責任者　：${form.resp || "未入力"}

【2. 複合災害シナリオ】
第一次災害　：${form.d1 || "未入力"}
二次災害　　：${form.d2.length ? form.d2.join("・") : "単独"}
訓練シナリオ：${form.scenario || "未設定"}
バイアス対策：${form.bias.length ? form.bias.join("、") : "未設定"}

【3. 要配慮者対応計画】
要配慮者　　：${form.vuln.length ? form.vuln.join("・") : "なし"}
専任比率　　：${form.vRatio || "未設定"}
停電時対応　：${form.powerOut || "未設定"}

【4. 役割分担】
${roles || "（未入力）"}
バックアップ：${form.backup || "未設定"}
外部連携　　：${form.ext.length ? form.ext.join("・") : "なし"}

【5. タイムライン】
${tl}
一次避難場所：${form.ev1 || "未入力"}
二次避難場所：${form.ev2 || "未入力"}
経路メモ　　：${form.routeNote || "なし"}

【6. 評価・PDCAサイクル】
計測指標　　：${form.kpis.length ? form.kpis.join("・") : "未設定"}
目標タイム　：${form.targetT || "未設定"}　前回実績：${form.prevT || "なし"}
振り返り方法：${form.debrief || "未設定"}
前回の課題　：${form.prevIssue || "なし"}
行動変容目標：${form.behavior || "未設定"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
減災教育普及協会　https://gensai.or.jp　info@gensai.or.jp
`;
}

// Word（.doc）ダウンロード：HTMLをWord互換形式で出力
function downloadWord(form) {
  const roles = form.roles.filter(r=>r.name).map(r=>`<tr><td>${r.role}</td><td>${r.name}</td></tr>`).join("");
  const tl = form.timeline.filter(t=>t.time&&t.content)
    .map(t=>`<tr><td>${t.time}</td><td>${t.content}</td><td>${t.actor||""}</td></tr>`).join("");
  const d = form.drillDate ? form.drillDate.replace(/-/g,"/") : "未入力";

  const html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8">
<style>
  body { font-family: "MS Gothic","Hiragino Kaku Gothic ProN",sans-serif; font-size:10.5pt; margin:2cm; }
  h1 { font-size:16pt; color:#0ea5e9; border-bottom:2px solid #0ea5e9; padding-bottom:4px; }
  h2 { font-size:11pt; color:#0369a1; margin-top:14pt; border-left:3px solid #0ea5e9; padding-left:6px; }
  table { border-collapse:collapse; width:100%; margin:6pt 0; }
  td,th { border:1px solid #cbd5e1; padding:4pt 6pt; font-size:10pt; }
  th { background:#f0f9ff; font-weight:bold; }
  .label { color:#64748b; width:110px; }
  .footer { font-size:8pt; color:#94a3b8; margin-top:24pt; border-top:1px solid #e2e8f0; padding-top:6pt; }
</style></head>
<body>
<h1>避難訓練計画書</h1>
<p style="font-size:9pt;color:#94a3b8;">powered by 減災教育普及協会</p>

<h2>1. 基本情報</h2>
<table>
  <tr><td class="label">組織名</td><td>${form.orgName||"未入力"}</td><td class="label">訓練日</td><td>${d} ${form.drillTime||""}</td></tr>
  <tr><td class="label">組織種別</td><td>${form.orgType||"未入力"}</td><td class="label">実施回数</td><td>${form.drillNum||"未入力"}</td></tr>
  <tr><td class="label">参加人数</td><td>${form.pcount?form.pcount+"名":"未入力"}</td><td class="label">訓練責任者</td><td>${form.resp||"未入力"}</td></tr>
</table>

<h2>2. 複合災害シナリオ</h2>
<table>
  <tr><td class="label">第一次災害</td><td>${form.d1||"未入力"}</td></tr>
  <tr><td class="label">二次災害</td><td>${form.d2.length?form.d2.join("・"):"単独"}</td></tr>
  <tr><td class="label">訓練シナリオ</td><td>${form.scenario||"未設定"}</td></tr>
  <tr><td class="label">バイアス対策</td><td>${form.bias.length?form.bias.join("、"):"未設定"}</td></tr>
</table>

<h2>3. 要配慮者対応計画</h2>
<table>
  <tr><td class="label">要配慮者</td><td>${form.vuln.length?form.vuln.join("・"):"なし"}</td></tr>
  <tr><td class="label">専任配置比率</td><td>${form.vRatio||"未設定"}</td></tr>
  <tr><td class="label">停電時対応</td><td>${form.powerOut||"未設定"}</td></tr>
</table>

<h2>4. 役割分担</h2>
<table>
  <tr><th>役割</th><th>担当者</th></tr>
  ${roles||"<tr><td colspan=2>未入力</td></tr>"}
</table>
<p style="font-size:10pt;"><b>バックアップ体制：</b>${form.backup||"未設定"}　<b>外部連携：</b>${form.ext.length?form.ext.join("・"):"なし"}</p>

<h2>5. タイムライン</h2>
<table>
  <tr><th style="width:60px">時刻</th><th>内容</th><th style="width:80px">担当</th></tr>
  ${tl||"<tr><td colspan=3>未入力</td></tr>"}
</table>
<p style="font-size:10pt;"><b>一次避難場所：</b>${form.ev1||"未入力"}　<b>二次避難場所：</b>${form.ev2||"未入力"}</p>
${form.routeNote?`<p style="font-size:10pt;"><b>経路メモ：</b>${form.routeNote}</p>`:""}

<h2>6. 評価・PDCAサイクル</h2>
<table>
  <tr><td class="label">計測指標</td><td>${form.kpis.length?form.kpis.join("・"):"未設定"}</td></tr>
  <tr><td class="label">目標タイム</td><td>${form.targetT||"未設定"}　（前回実績：${form.prevT||"なし"}）</td></tr>
  <tr><td class="label">振り返り方法</td><td>${form.debrief||"未設定"}</td></tr>
  <tr><td class="label">前回からの課題</td><td>${form.prevIssue||"なし"}</td></tr>
  <tr><td class="label">行動変容目標</td><td>${form.behavior||"未設定"}</td></tr>
</table>

<div class="footer">減災教育普及協会　https://gensai.or.jp　info@gensai.or.jp　TEL: 045-532-8937</div>
</body></html>`;

  const blob = new Blob([html], { type:"application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `避難訓練計画書_${form.orgName||"未入力"}_${(form.drillDate||"").replace(/-/g,"")}.doc`;
  a.click();
  URL.revokeObjectURL(url);
}

// Excel（.xls）ダウンロード
function downloadExcel(form) {
  const d = form.drillDate ? form.drillDate.replace(/-/g,"/") : "未入力";
  const roles = form.roles.filter(r=>r.name);
  const tl = form.timeline.filter(t=>t.time&&t.content);

  const rows = [
    ["避難訓練計画書","","",""],
    ["powered by 減災教育普及協会","","",""],
    ["","","",""],
    ["【基本情報】","","",""],
    ["組織名",form.orgName||"","訓練日",d+" "+(form.drillTime||"")],
    ["組織種別",form.orgType||"","実施回数",form.drillNum||""],
    ["参加人数",form.pcount?form.pcount+"名":"","訓練責任者",form.resp||""],
    ["","","",""],
    ["【複合災害シナリオ】","","",""],
    ["第一次災害",form.d1||"","二次災害",form.d2.join("・")||"単独"],
    ["シナリオ",form.scenario||"","",""],
    ["バイアス対策",form.bias.join("、")||"未設定","",""],
    ["","","",""],
    ["【要配慮者対応計画】","","",""],
    ["要配慮者",form.vuln.join("・")||"なし","専任比率",form.vRatio||"未設定"],
    ["停電時対応",form.powerOut||"未設定","",""],
    ["","","",""],
    ["【役割分担】","","",""],
    ["役割","担当者","バックアップ",form.backup||"未設定"],
    ...roles.map(r=>[r.role,r.name,"",""]),
    ["外部連携",form.ext.join("・")||"なし","",""],
    ["","","",""],
    ["【タイムライン】","","",""],
    ["時刻","内容","担当",""],
    ...tl.map(t=>[t.time,t.content,t.actor||"",""]),
    ["一次避難場所",form.ev1||"","二次避難場所",form.ev2||""],
    ["","","",""],
    ["【評価・PDCAサイクル】","","",""],
    ["計測指標",form.kpis.join("・")||"未設定","",""],
    ["目標タイム",form.targetT||"未設定","前回実績",form.prevT||"なし"],
    ["振り返り方法",form.debrief||"未設定","",""],
    ["前回の課題",form.prevIssue||"なし","",""],
    ["行動変容目標",form.behavior||"未設定","",""],
    ["","","",""],
    ["減災教育普及協会","https://gensai.or.jp","info@gensai.or.jp",""],
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
  <Style ss:ID="h1"><Font ss:Bold="1" ss:Size="14" ss:Color="#0ea5e9"/></Style>
  <Style ss:ID="h2"><Font ss:Bold="1" ss:Color="#0369a1"/><Interior ss:Color="#f0f9ff" ss:Pattern="Solid"/></Style>
  <Style ss:ID="label"><Font ss:Bold="1" ss:Color="#475569"/></Style>
</Styles>
<Worksheet ss:Name="避難訓練計画書">
<Table>
${rows.map((row,ri)=>`<Row>${row.map((cell,ci)=>{
  const st = ri===0?"h1":ri===3||ri===8||ri===13||ri===17||ri===23||ri===28?"h2":ci===0&&ri>3?"label":"";
  return `<Cell${st?` ss:StyleID="${st}"`:""}><Data ss:Type="String">${String(cell).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</Data></Cell>`;
}).join("")}</Row>`).join("")}
</Table>
</Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type:"application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `避難訓練計画書_${form.orgName||"未入力"}_${(form.drillDate||"").replace(/-/g,"")}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

// PDF（印刷ダイアログ経由）
function downloadPDF(form) {
  const roles = form.roles.filter(r=>r.name).map(r=>`<tr><td>${r.role}</td><td>${r.name}</td></tr>`).join("");
  const tl = form.timeline.filter(t=>t.time&&t.content)
    .map(t=>`<tr><td>${t.time}</td><td>${t.content}</td><td>${t.actor||""}</td></tr>`).join("");
  const d = form.drillDate ? form.drillDate.replace(/-/g,"/") : "未入力";

  const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">
<style>
  @media print { @page { margin:1.5cm; size:A4; } body { margin:0; } }
  body { font-family:"Hiragino Kaku Gothic ProN","MS Gothic",sans-serif; font-size:10pt; color:#1e293b; }
  h1 { font-size:15pt; color:#0ea5e9; border-bottom:2px solid #0ea5e9; padding-bottom:4px; margin-bottom:2px; }
  .sub { font-size:8pt; color:#94a3b8; margin-bottom:12pt; }
  h2 { font-size:10pt; font-weight:bold; color:#0369a1; background:#f0f9ff; border-left:3px solid #0ea5e9; padding:3px 8px; margin:12pt 0 4pt; }
  table { border-collapse:collapse; width:100%; margin-bottom:6pt; }
  td,th { border:1px solid #cbd5e1; padding:3pt 5pt; font-size:9.5pt; }
  th { background:#f8fafc; font-weight:bold; }
  .label { color:#64748b; width:100px; font-weight:bold; }
  .footer { font-size:7.5pt; color:#94a3b8; margin-top:16pt; border-top:1px solid #e2e8f0; padding-top:4pt; text-align:center; }
</style></head><body>
<h1>避難訓練計画書</h1>
<div class="sub">powered by 減災教育普及協会</div>

<h2>1. 基本情報</h2>
<table>
  <tr><td class="label">組織名</td><td>${form.orgName||""}</td><td class="label">訓練日</td><td>${d} ${form.drillTime||""}</td></tr>
  <tr><td class="label">組織種別</td><td>${form.orgType||""}</td><td class="label">実施回数</td><td>${form.drillNum||""}</td></tr>
  <tr><td class="label">参加人数</td><td>${form.pcount?form.pcount+"名":""}</td><td class="label">訓練責任者</td><td>${form.resp||""}</td></tr>
</table>

<h2>2. 複合災害シナリオ</h2>
<table>
  <tr><td class="label">第一次災害</td><td>${form.d1||""}</td><td class="label">二次災害</td><td>${form.d2.join("・")||"単独"}</td></tr>
  <tr><td class="label">シナリオ</td><td colspan="3">${form.scenario||"未設定"}</td></tr>
  <tr><td class="label">バイアス対策</td><td colspan="3">${form.bias.join("、")||"未設定"}</td></tr>
</table>

<h2>3. 要配慮者対応計画</h2>
<table>
  <tr><td class="label">要配慮者</td><td>${form.vuln.join("・")||"なし"}</td><td class="label">専任比率</td><td>${form.vRatio||""}</td></tr>
  <tr><td class="label">停電時対応</td><td colspan="3">${form.powerOut||"未設定"}</td></tr>
</table>

<h2>4. 役割分担</h2>
<table>
  <tr><th>役割</th><th>担当者</th></tr>
  ${roles||"<tr><td colspan=2>—</td></tr>"}
</table>
<p style="font-size:9pt">バックアップ体制：${form.backup||"未設定"}　外部連携：${form.ext.join("・")||"なし"}</p>

<h2>5. タイムライン</h2>
<table>
  <tr><th style="width:55px">時刻</th><th>内容</th><th style="width:70px">担当</th></tr>
  ${tl||"<tr><td colspan=3>—</td></tr>"}
</table>
<p style="font-size:9pt">一次避難：${form.ev1||"—"}　二次避難：${form.ev2||"—"}　${form.routeNote?"経路メモ："+form.routeNote:""}</p>

<h2>6. 評価・PDCAサイクル</h2>
<table>
  <tr><td class="label">計測指標</td><td colspan="3">${form.kpis.join("・")||"未設定"}</td></tr>
  <tr><td class="label">目標タイム</td><td>${form.targetT||"未設定"}</td><td class="label">前回実績</td><td>${form.prevT||"なし"}</td></tr>
  <tr><td class="label">振り返り</td><td colspan="3">${form.debrief||"未設定"}</td></tr>
  <tr><td class="label">前回の課題</td><td colspan="3">${form.prevIssue||"なし"}</td></tr>
  <tr><td class="label">行動変容目標</td><td colspan="3">${form.behavior||"未設定"}</td></tr>
</table>

<div class="footer">減災教育普及協会　https://gensai.or.jp　info@gensai.or.jp　TEL: 045-532-8937</div>
</body></html>`;

  const w = window.open("","_blank","width=800,height=900");
  w.document.write(html);
  w.document.close();
  w.onload = () => { w.focus(); w.print(); };
}

// ── メインアプリ ──────────────────────────────────────
export default function App() {
  const [view, setView]         = useState("login");   // login | register | app | formats
  const [session, setSession]   = useState(null);      // { token, user }
  const [authForm, setAuthForm] = useState({ email:"", password:"" });
  const [authErr, setAuthErr]   = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [form, setForm]         = useState(BLANK_FORM);
  const [step, setStep]         = useState(0);
  const [saved, setSaved]       = useState(false);

  const [formats, setFormats]   = useState([]);
  const [fmtLoading, setFmtLoading] = useState(false);
  const [fmtName, setFmtName]   = useState("");
  const [fmtSaving, setFmtSaving] = useState(false);
  const [fmtMsg, setFmtMsg]     = useState("");
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickMsg, setQuickMsg]       = useState("");  // "" | "saved" | "error"
  const [editingFmt, setEditingFmt] = useState(null); // format id being renamed

  // ── 認証 ──
  async function doLogin() {
    setAuthLoading(true); setAuthErr("");
    try {
      const d = await supaFetch("/auth/v1/token?grant_type=password", {
        method:"POST",
        body: JSON.stringify({ email: authForm.email, password: authForm.password })
      });
      setSession({ token: d.access_token, user: d.user });
      setView("app");
    } catch(e) { setAuthErr("メールアドレスまたはパスワードが正しくありません"); }
    finally { setAuthLoading(false); }
  }

  async function doRegister() {
    setAuthLoading(true); setAuthErr("");
    try {
      await supaFetch("/auth/v1/signup", {
        method:"POST",
        body: JSON.stringify({ email: authForm.email, password: authForm.password })
      });
      setAuthErr("確認メールを送信しました。メールのリンクをクリックしてからログインしてください。");
    } catch(e) { setAuthErr(e.message); }
    finally { setAuthLoading(false); }
  }

  function doLogout() {
    setSession(null); setView("login"); setForm(BLANK_FORM); setStep(0); setSaved(false);
  }

  // ── フォーマット一覧取得 ──
  const loadFormats = useCallback(async () => {
    if (!session) return;
    setFmtLoading(true);
    try {
      const d = await supaFetch("/rest/v1/drill_formats?select=*&order=updated_at.desc", {
        token: session.token
      });
      setFormats(Array.isArray(d) ? d : []);
    } catch(e) { console.error(e); }
    finally { setFmtLoading(false); }
  }, [session]);

  useEffect(() => { if (view === "formats") loadFormats(); }, [view, loadFormats]);

  // ── フォーマット保存 ──
  async function saveFormat() {
    if (!fmtName.trim()) { setFmtMsg("フォーマット名を入力してください"); return; }
    setFmtSaving(true); setFmtMsg("");
    try {
      await supaFetch("/rest/v1/drill_formats", {
        method:"POST",
        token: session.token,
        headers:{ "Prefer":"return=minimal" },
        body: JSON.stringify({
          user_id:    session.user.id,
          name:       fmtName,
          org_name:   form.orgName,
          org_type:   form.orgType,
          drill_time: form.drillTime,
          drill_num:  form.drillNum,
          d1:         form.d1,
          d2:         form.d2,
          bias:       form.bias,
          vuln:       form.vuln,
          v_ratio:    form.vRatio,
          power_out:  form.powerOut,
          roles:      form.roles,
          backup:     form.backup,
          ext:        form.ext,
          timeline:   form.timeline,
          ev1:        form.ev1,
          ev2:        form.ev2,
          route_note: form.routeNote,
          kpis:       form.kpis,
          target_t:   form.targetT,
          debrief:    form.debrief,
          behavior:   form.behavior,
        })
      });
      setFmtMsg(`「${fmtName}」を保存しました`);
      setFmtName("");
      loadFormats();
    } catch(e) { setFmtMsg("保存に失敗しました: " + e.message); }
    finally { setFmtSaving(false); }
  }

  // ── 途中保存（クイックセーブ）──
  async function quickSave() {
    setQuickSaving(true); setQuickMsg("");
    const name = fmtName.trim() || `${form.orgName||"未入力"}の計画書（途中保存）`;
    try {
      // 同名の既存フォーマットを探して上書き、なければ新規作成
      const existing = formats.find(f => f.name === name);
      if (existing) {
        await supaFetch(`/rest/v1/drill_formats?id=eq.${existing.id}`, {
          method: "PATCH",
          token: session.token,
          headers: { "Prefer": "return=minimal" },
          body: JSON.stringify({
            org_name: form.orgName, org_type: form.orgType, drill_time: form.drillTime,
            drill_num: form.drillNum, d1: form.d1, d2: form.d2, bias: form.bias,
            vuln: form.vuln, v_ratio: form.vRatio, power_out: form.powerOut,
            roles: form.roles, backup: form.backup, ext: form.ext,
            timeline: form.timeline, ev1: form.ev1, ev2: form.ev2,
            route_note: form.routeNote, kpis: form.kpis, target_t: form.targetT,
            debrief: form.debrief, behavior: form.behavior,
          })
        });
      } else {
        await supaFetch("/rest/v1/drill_formats", {
          method: "POST",
          token: session.token,
          headers: { "Prefer": "return=minimal" },
          body: JSON.stringify({
            user_id: session.user.id, name,
            org_name: form.orgName, org_type: form.orgType, drill_time: form.drillTime,
            drill_num: form.drillNum, d1: form.d1, d2: form.d2, bias: form.bias,
            vuln: form.vuln, v_ratio: form.vRatio, power_out: form.powerOut,
            roles: form.roles, backup: form.backup, ext: form.ext,
            timeline: form.timeline, ev1: form.ev1, ev2: form.ev2,
            route_note: form.routeNote, kpis: form.kpis, target_t: form.targetT,
            debrief: form.debrief, behavior: form.behavior,
          })
        });
      }
      setQuickMsg("saved");
      loadFormats();
      setTimeout(() => setQuickMsg(""), 3000);
    } catch(e) {
      setQuickMsg("error");
      setTimeout(() => setQuickMsg(""), 3000);
    } finally {
      setQuickSaving(false);
    }
  }

  // ── フォーマット読み込み（編集）──
  function loadFormat(fmt) {
    setForm({
      ...BLANK_FORM,
      orgName:   fmt.org_name   || "",
      orgType:   fmt.org_type   || "",
      drillTime: fmt.drill_time || "",
      drillNum:  fmt.drill_num  || "",
      d1:        fmt.d1         || "",
      d2:        fmt.d2         || [],
      bias:      fmt.bias       || [],
      vuln:      fmt.vuln       || [],
      vRatio:    fmt.v_ratio    || "",
      powerOut:  fmt.power_out  || "",
      roles:     fmt.roles      || DEFAULT_ROLES,
      backup:    fmt.backup     || "",
      ext:       fmt.ext        || [],
      timeline:  fmt.timeline   || DEFAULT_TL,
      ev1:       fmt.ev1        || "",
      ev2:       fmt.ev2        || "",
      routeNote: fmt.route_note || "",
      kpis:      fmt.kpis       || [],
      targetT:   fmt.target_t   || "",
      debrief:   fmt.debrief    || "",
      behavior:  fmt.behavior   || "",
    });
    setStep(0); setView("app"); setSaved(false);
  }

  // ── フォーマット更新 ──
  async function updateFormat(id) {
    const fmt = formats.find(f => f.id === id);
    if (!fmt) return;
    setFmtSaving(true);
    try {
      await supaFetch(`/rest/v1/drill_formats?id=eq.${id}`, {
        method:"PATCH",
        token: session.token,
        headers:{ "Prefer":"return=minimal" },
        body: JSON.stringify({
          name:       editingFmt?.name || fmt.name,
          org_name:   form.orgName,
          org_type:   form.orgType,
          drill_time: form.drillTime,
          drill_num:  form.drillNum,
          d1:         form.d1,
          d2:         form.d2,
          bias:       form.bias,
          vuln:       form.vuln,
          v_ratio:    form.vRatio,
          power_out:  form.powerOut,
          roles:      form.roles,
          backup:     form.backup,
          ext:        form.ext,
          timeline:   form.timeline,
          ev1:        form.ev1,
          ev2:        form.ev2,
          route_note: form.routeNote,
          kpis:       form.kpis,
          target_t:   form.targetT,
          debrief:    form.debrief,
          behavior:   form.behavior,
        })
      });
      setFmtMsg("更新しました");
      setEditingFmt(null);
      loadFormats();
    } catch(e) { setFmtMsg("更新失敗: " + e.message); }
    finally { setFmtSaving(false); }
  }

  // ── フォーマット削除 ──
  async function deleteFormat(id) {
    if (!window.confirm("このフォーマットを削除しますか？")) return;
    try {
      await supaFetch(`/rest/v1/drill_formats?id=eq.${id}`, {
        method:"DELETE",
        token: session.token,
      });
      loadFormats();
    } catch(e) { alert("削除失敗: " + e.message); }
  }

  const set  = (k,v) => setForm(f=>({...f,[k]:v}));
  const tog  = (k,v) => setForm(f=>({...f,[k]:f[k].includes(v)?f[k].filter(x=>x!==v):[...f[k],v]}));

  function validate() {
    if (step===0){if(!form.orgName.trim()){alert("組織名を入力してください");return false;}if(!form.drillDate){alert("訓練日を選択してください");return false;}if(!form.orgType){alert("組織種別を選択してください");return false;}}
    if (step===1&&!form.d1){alert("第一次災害を選択してください");return false;}
    return true;
  }

  function handleComplete() {
    setSaved(true);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ── 認証画面 ──
  if (view==="login"||view==="register") {
    const isReg = view==="register";
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 w-full max-w-sm p-8">
          <div className="text-center mb-6">
              <h1 className="text-lg font-semibold text-gray-900">避難訓練計画書フォーマット</h1>
            <p className="text-xs text-gray-400 mt-1">powered by 減災教育普及協会</p>
          </div>

          <div className="flex rounded-lg border border-gray-200 mb-5 overflow-hidden text-sm">
            <button onClick={()=>{setView("login");setAuthErr("");}}
              className={`flex-1 py-2 transition-colors ${!isReg?"bg-sky-500 text-white font-medium":"text-gray-500 hover:bg-gray-50"}`}>
              ログイン
            </button>
            <button onClick={()=>{setView("register");setAuthErr("");}}
              className={`flex-1 py-2 transition-colors ${isReg?"bg-sky-500 text-white font-medium":"text-gray-500 hover:bg-gray-50"}`}>
              新規登録
            </button>
          </div>

          <div className="space-y-3">
            <Inp type="email" placeholder="メールアドレス" value={authForm.email}
              onChange={e=>setAuthForm(f=>({...f,email:e.target.value}))} />
            <Inp type="password" placeholder="パスワード（8文字以上）" value={authForm.password}
              onChange={e=>setAuthForm(f=>({...f,password:e.target.value}))}
              onKeyDown={e=>e.key==="Enter"&&(isReg?doRegister():doLogin())} />
          </div>

          {authErr && (
            <p className={`text-xs mt-3 ${authErr.includes("送信")||authErr.includes("確認")?"text-green-600":"text-red-500"}`}>
              {authErr}
            </p>
          )}

          <button onClick={isReg?doRegister:doLogin} disabled={authLoading}
            className="w-full mt-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
            {authLoading&&<Spinner/>}
            {isReg?"アカウントを作成する":"ログイン"}
          </button>
        </div>
      </div>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ── フォーマット管理画面 ──
  if (view==="formats") {
    return (
      <div className="max-w-xl mx-auto p-4">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-gray-900">保存済みフォーマット</h2>
            <p className="text-xs text-gray-400">{session.user.email}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={()=>setView("app")}
              className="text-sm text-sky-600 border border-sky-200 px-3 py-1.5 rounded-lg hover:bg-sky-50">
              ← フォームに戻る
            </button>
            <button onClick={doLogout}
              className="text-sm text-gray-400 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">
              ログアウト
            </button>
          </div>
        </div>

        {/* 現在のフォーム内容を保存 */}
        <div className="bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 rounded-xl p-4 mb-5">
          <p className="text-xs font-medium text-gray-700 mb-2">現在の入力内容をフォーマットとして保存</p>
          <div className="flex gap-2">
            <Inp value={fmtName} onChange={e=>setFmtName(e.target.value)}
              placeholder="フォーマット名（例：○○保育園 標準設定）"
              onKeyDown={e=>e.key==="Enter"&&saveFormat()} />
            <button onClick={saveFormat} disabled={fmtSaving}
              className="px-4 py-2 bg-sky-500 text-white text-sm rounded-lg hover:bg-sky-600 disabled:opacity-60 flex items-center gap-1 whitespace-nowrap">
              {fmtSaving&&<Spinner/>}保存
            </button>
          </div>
          {fmtMsg&&<p className={`text-xs mt-2 ${fmtMsg.includes("失敗")?"text-red-500":"text-green-600"}`}>{fmtMsg}</p>}
        </div>

        {/* フォーマット一覧 */}
        {fmtLoading ? (
          <div className="flex justify-center py-8"><Spinner/></div>
        ) : formats.length===0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            まだフォーマットが保存されていません。<br/>フォームに入力して保存してください。
          </div>
        ) : (
          <div className="space-y-2">
            {formats.map(fmt=>(
              <div key={fmt.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:border-sky-300 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {editingFmt?.id===fmt.id ? (
                      <div className="flex gap-2 mb-2">
                        <Inp value={editingFmt.name} onChange={e=>setEditingFmt(f=>({...f,name:e.target.value}))} />
                        <button onClick={()=>updateFormat(fmt.id)}
                          className="px-3 py-1.5 bg-green-500 text-white text-xs rounded-lg whitespace-nowrap">保存</button>
                        <button onClick={()=>setEditingFmt(null)}
                          className="px-3 py-1.5 border border-gray-200 text-gray-500 text-xs rounded-lg">キャンセル</button>
                      </div>
                    ) : (
                      <p className="font-medium text-sm text-gray-800 truncate">{fmt.name}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {fmt.org_name&&<span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{fmt.org_name}</span>}
                      {fmt.org_type&&<span className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">{fmt.org_type}</span>}
                      {fmt.d1&&<span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{fmt.d1}</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      更新：{new Date(fmt.updated_at).toLocaleDateString("ja-JP")}
                    </p>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={()=>loadFormat(fmt)}
                      className="px-3 py-1.5 bg-sky-500 text-white text-xs rounded-lg hover:bg-sky-600">
                      読み込む
                    </button>
                    <button onClick={()=>setEditingFmt({id:fmt.id,name:fmt.name})}
                      className="px-3 py-1.5 border border-gray-200 text-gray-500 text-xs rounded-lg hover:bg-gray-50">
                      編集
                    </button>
                    <button onClick={()=>deleteFormat(fmt.id)}
                      className="px-3 py-1.5 border border-red-100 text-red-400 text-xs rounded-lg hover:bg-red-50">
                      削除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ── 完了画面 ──
  if (saved) return (
    <div className="max-w-lg mx-auto p-6">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">✓</span>
        </div>
        <h2 className="text-xl font-semibold mb-1">計画書が完成しました</h2>
        <p className="text-sm text-gray-500">形式を選んでダウンロードしてください</p>
      </div>

      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-6 text-sm space-y-1">
        <div className="flex gap-2"><span className="text-gray-400 w-24">組織名</span><span className="font-medium text-gray-800">{form.orgName}</span></div>
        <div className="flex gap-2"><span className="text-gray-400 w-24">訓練日</span><span>{form.drillDate?.replace(/-/g,"/")}</span></div>
        <div className="flex gap-2"><span className="text-gray-400 w-24">第一次災害</span><span>{form.d1}</span></div>
        <div className="flex gap-2"><span className="text-gray-400 w-24">要配慮者</span><span>{form.vuln.length?form.vuln.join("・"):"なし"}</span></div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <button onClick={()=>downloadWord(form)}
          className="flex flex-col items-center gap-2 p-4 bg-white border-2 border-blue-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all group">
          <span className="text-3xl">📄</span>
          <span className="text-sm font-semibold text-blue-700">Word</span>
          <span className="text-xs text-gray-400">.doc形式</span>
        </button>
        <button onClick={()=>downloadExcel(form)}
          className="flex flex-col items-center gap-2 p-4 bg-white border-2 border-green-200 rounded-xl hover:border-green-400 hover:bg-green-50 transition-all group">
          <span className="text-3xl">📊</span>
          <span className="text-sm font-semibold text-green-700">Excel</span>
          <span className="text-xs text-gray-400">.xls形式</span>
        </button>
        <button onClick={()=>downloadPDF(form)}
          className="flex flex-col items-center gap-2 p-4 bg-white border-2 border-red-200 rounded-xl hover:border-red-400 hover:bg-red-50 transition-all group">
          <span className="text-3xl">📋</span>
          <span className="text-sm font-semibold text-red-700">PDF</span>
          <span className="text-xs text-gray-400">印刷して保存</span>
        </button>
      </div>

      <p className="text-xs text-center text-gray-400 mb-5">PDFは印刷ダイアログで「PDFとして保存」を選択してください</p>

      <div className="flex justify-center">
        <button onClick={()=>{setForm(BLANK_FORM);setStep(0);setSaved(false);}}
          className="text-sm text-gray-400 border border-gray-200 px-5 py-2 rounded-lg hover:bg-gray-50">
          新しい計画を作成する
        </button>
      </div>
    </div>
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ── メインフォーム ──
  const isLast = step === STEPS.length-1;
  return (
    <div className="max-w-xl mx-auto p-4">
      {/* トップバー */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs text-gray-400 truncate">{session.user.email}</div>
        <div className="flex gap-2">
          <button onClick={()=>{setView("formats");loadFormats();}}
            className="text-xs text-sky-600 border border-sky-200 px-2.5 py-1 rounded-lg hover:bg-sky-50 flex items-center gap-1">
            フォーマット管理
          </button>
          <button onClick={doLogout}
            className="text-xs text-gray-400 border border-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-50">
            ログアウト
          </button>
        </div>
      </div>

      {/* プログレス＋途中保存 */}
      <div className="mb-5">
        <div className="flex justify-between text-sm mb-2">
          <span className="font-semibold text-gray-700">{STEPS[step]}</span>
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-500">{step+1} / {STEPS.length}</span>
            {/* 途中保存ボタン */}
            <button
              onClick={quickSave}
              disabled={quickSaving}
              title={fmtName.trim() ? `「${fmtName}」として保存` : "途中経過を保存"}
              className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-all ${
                quickMsg==="saved"  ? "border-green-300 bg-green-50 text-green-600" :
                quickMsg==="error"  ? "border-red-300 bg-red-50 text-red-500" :
                quickSaving         ? "border-gray-200 text-gray-400 cursor-not-allowed" :
                "border-sky-200 text-sky-600 hover:bg-sky-50"
              }`}>
              {quickSaving ? (
                <><svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>保存中</>
              ) : quickMsg==="saved" ? "✓ 保存しました" :
                quickMsg==="error" ? "✗ 保存失敗" : "途中保存"}
            </button>
          </div>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-sky-500 rounded-full transition-all duration-300"
            style={{width:`${((step+1)/STEPS.length)*100}%`}} />
        </div>
        {/* 保存名インジケーター */}
        {fmtName.trim() && (
          <div className="mt-1.5 text-xs text-gray-400 text-right">
            保存名：<span className="text-sky-600 font-medium">{fmtName}</span>
          </div>
        )}
      </div>

      {/* ── Step 0 ── */}
      {step===0&&<div>
        <div className="text-sm font-medium text-sky-500 mb-1.5">Step 1 / 7</div>
        <div className="text-xl font-bold text-gray-900 mb-1.5">組織・実施概要</div>
        <div className="text-sm text-gray-500 mb-5 leading-relaxed">どんな組織でも使える汎用フォーマット。組織種別に応じて設問が最適化されます。</div>
        <Fld label="組織名・施設名" required><Inp value={form.orgName} onChange={e=>set("orgName",e.target.value)} placeholder="例：○○保育園、△△自治会、□□株式会社"/></Fld>
        <div className="grid grid-cols-2 gap-3">
          <Fld label="訓練実施日" required><Inp type="date" value={form.drillDate} onChange={e=>set("drillDate",e.target.value)}/></Fld>
          <Fld label="時間帯"><Sl value={form.drillTime} onChange={e=>set("drillTime",e.target.value)} options={["","午前（9:00〜12:00）","午後（13:00〜17:00）","夜間（18:00〜）","早朝・登園前","その他"]}/></Fld>
        </div>
        <Fld label="組織の種別" required>
          <div className="flex flex-wrap gap-2">
            {["保育園・認定こども園","幼稚園","小・中・高校","企業・事業所","地域・自治会","福祉施設","その他"].map(v=>(
              <Tag key={v} label={v} selected={form.orgType===v} onClick={()=>set("orgType",v)}/>
            ))}
          </div>
        </Fld>
        <div className="grid grid-cols-2 gap-3">
          <Fld label="参加人数"><Inp type="number" value={form.pcount} onChange={e=>set("pcount",e.target.value)} placeholder="例：50"/></Fld>
          <Fld label="訓練責任者"><Inp value={form.resp} onChange={e=>set("resp",e.target.value)} placeholder="氏名または役職"/></Fld>
        </div>
        <Fld label="今回は何回目？" hint="継続実施の場合、前回課題からの改善（PDCA）を記録できます">
          <div className="flex flex-wrap gap-2">
            {["初回","2〜3回目","4回以上（継続）"].map(v=>(
              <Tag key={v} label={v} selected={form.drillNum===v} onClick={()=>set("drillNum",v)}/>
            ))}
          </div>
        </Fld>
      </div>}

      {/* ── Step 1 ── */}
      {step===1&&<div>
        <div className="text-sm font-medium text-sky-500 mb-1.5">Step 2 / 7</div>
        <div className="text-xl font-bold text-gray-900 mb-1.5">複合災害シナリオ</div>
        <div className="text-sm text-gray-500 mb-5 leading-relaxed">連鎖する複合災害を想定することが減災教育2.0の核心です。</div>
        <Note><strong className="text-gray-800">複合災害とは：</strong>地震→津波・火災・停電・断水が同時多発する状況。乳幼児環境では「避難＋授乳＋保温」が同時に必要になります。</Note>
        <Fld label="第一次災害（トリガー）" required>
          <div className="flex flex-wrap gap-2">
            {["地震","火災（単独）","台風・大雨","その他"].map(v=>(
              <Tag key={v} label={v} selected={form.d1===v} onClick={()=>set("d1",v)}/>
            ))}
          </div>
        </Fld>
        <Fld label="連鎖する二次災害（複数選択可）">
          <div className="grid grid-cols-2 gap-1.5">
            {[["津波","到達予想時間を事前確認"],["火災（延焼）","風向・出口確認が必須"],["停電","医療機器・照明・通信に影響"],["断水","衛生・授乳・薬の調合に影響"],["土砂・液状化","避難経路が使えなくなる"],["通信途絶","保護者連絡・安否確認に影響"]].map(([v,s])=>(
              <ChkCard key={v} label={v} sub={s} checked={form.d2.includes(v)} onChange={()=>tog("d2",v)}/>
            ))}
          </div>
        </Fld>
        <Fld label="訓練シナリオ文（任意）"><Tx value={form.scenario} onChange={e=>set("scenario",e.target.value)} placeholder="例：震度6強発生と同時に施設東側から出火。停電・断水発生。在園児22名（うち乳児4名）在館。津波到達まで18分。"/></Fld>
        <Fld label="正常化の偏見への対策">
          <div className="grid grid-cols-2 gap-1.5">
            {["「まだ大丈夫」を言わせない判断基準の明示","過去被害事例の事前学習","指示待ち禁止・自己判断訓練","想定外シナリオ追加（経路遮断など）"].map(v=>(
              <ChkCard key={v} label={v} checked={form.bias.includes(v)} onChange={()=>tog("bias",v)}/>
            ))}
          </div>
        </Fld>
      </div>}

      {/* ── Step 2 ── */}
      {step===2&&<div>
        <div className="text-sm font-medium text-sky-500 mb-1.5">Step 3 / 7</div>
        <div className="text-xl font-bold text-gray-900 mb-1.5">要配慮者への個別対応計画</div>
        <div className="text-sm text-gray-500 mb-5 leading-relaxed">「平均的な大人」を前提にしない設計。減災教育2.0の核心部分です。</div>
        <Fld label="施設・組織内の要配慮者">
          <div className="grid grid-cols-2 gap-1.5">
            {[["乳児（0〜1歳）","抱っこ・授乳・体温調節が必要"],["1〜3歳児","自力避難不可・パニックしやすい"],["妊産婦","移動速度・姿勢に配慮"],["高齢者（自力移動困難）","車椅子・歩行補助器具の確保"],["身体障害者","器具ごとの経路確認が必要"],["医療的ケア児・者","停電時の機器・薬対応が必須"],["知的・精神障害者","急変・パニック時の個別計画"],["外国人・日本語非対応","多言語・絵示サイン対応"]].map(([v,s])=>(
              <ChkCard key={v} label={v} sub={s} checked={form.vuln.includes(v)} onChange={()=>tog("vuln",v)}/>
            ))}
          </div>
        </Fld>
        <Fld label="要配慮者1人への専任担当者数">
          <div className="flex flex-wrap gap-2">
            {["1対1","2人に1人","都度判断","未定"].map(v=>(
              <Tag key={v} label={v} selected={form.vRatio===v} onClick={()=>set("vRatio",v)}/>
            ))}
          </div>
        </Fld>
        <Fld label="停電時の要配慮者対応"><Tx value={form.powerOut} onChange={e=>set("powerOut",e.target.value)} placeholder="例：人工呼吸器使用の在園児は看護師が手動バッグで対応。調乳は備蓄ミネラルウォーター＋カセットコンロ使用。"/></Fld>
        <Note><strong className="text-gray-800">乳幼児施設の場合：</strong>保育士1名が抱えられる子どもの数・おんぶ紐の本数・非常用ベビーカーの台数を事前確認し、訓練に組み込んでください。</Note>
      </div>}

      {/* ── Step 3 ── */}
      {step===3&&<div>
        <div className="text-sm font-medium text-sky-500 mb-1.5">Step 4 / 7</div>
        <div className="text-xl font-bold text-gray-900 mb-1.5">訓練スタッフの役割分担</div>
        <div className="text-sm text-gray-500 mb-5 leading-relaxed">人事異動・欠席時のバックアップまで設計します。</div>
        <Fld label="役割と担当者">
          {form.roles.map((r,i)=>(
            <div key={i} className="grid grid-cols-2 gap-2 mb-2">
              <Sl value={r.role} onChange={e=>setForm(f=>{const roles=[...f.roles];roles[i]={...roles[i],role:e.target.value};return{...f,roles};})} options={ROLE_OPTIONS}/>
              <Inp value={r.name} onChange={e=>setForm(f=>{const roles=[...f.roles];roles[i]={...roles[i],name:e.target.value};return{...f,roles};})} placeholder="担当者名または役職"/>
            </div>
          ))}
          <button onClick={()=>setForm(f=>({...f,roles:[...f.roles,{role:"その他",name:""}]}))}
            className="text-sm text-sky-500 mt-1">＋ 行を追加</button>
        </Fld>
        <div className="border-t border-gray-100 my-4"/>
        <Fld label="担当者不在時のバックアップ体制" hint="人事異動・休暇時に機能しなくなるのが最大のリスク">
          <div className="flex flex-wrap gap-2">
            {["代理担当者を事前に指定","隣接役割の担当者が兼務","未設定"].map(v=>(
              <Tag key={v} label={v} selected={form.backup===v} onClick={()=>set("backup",v)}/>
            ))}
          </div>
        </Fld>
        <Fld label="外部機関との連携">
          <div className="grid grid-cols-2 gap-1.5">
            {["消防署","市区町村防災担当","警察署","地域自治会","医療機関・学校医","減災NPO・専門家"].map(v=>(
              <ChkCard key={v} label={v} checked={form.ext.includes(v)} onChange={()=>tog("ext",v)}/>
            ))}
          </div>
        </Fld>
      </div>}

      {/* ── Step 4 ── */}
      {step===4&&<div>
        <div className="text-sm font-medium text-sky-500 mb-1.5">Step 5 / 7</div>
        <div className="text-xl font-bold text-gray-900 mb-1.5">当日のタイムスケジュール</div>
        <div className="text-sm text-gray-500 mb-5 leading-relaxed">事前→発生時→事後の3段階。担当者まで明記します。</div>
        <Fld label="タイムライン（時刻 / 内容 / 担当）">
          <div className="grid grid-cols-[58px_1fr_80px] gap-1.5 mb-1 text-xs text-gray-400">
            <span>時刻</span><span>内容</span><span>担当</span>
          </div>
          {form.timeline.map((tl,i)=>(
            <div key={i} className="grid grid-cols-[58px_1fr_80px] gap-1.5 mb-1.5">
              <Inp value={tl.time} onChange={e=>setForm(f=>{const t=[...f.timeline];t[i]={...t[i],time:e.target.value};return{...f,timeline:t};})} placeholder="時刻"/>
              <Inp value={tl.content} onChange={e=>setForm(f=>{const t=[...f.timeline];t[i]={...t[i],content:e.target.value};return{...f,timeline:t};})} placeholder="内容"/>
              <Inp value={tl.actor} onChange={e=>setForm(f=>{const t=[...f.timeline];t[i]={...t[i],actor:e.target.value};return{...f,timeline:t};})} placeholder="担当"/>
            </div>
          ))}
          <button onClick={()=>setForm(f=>({...f,timeline:[...f.timeline,{time:"",content:"",actor:""}]}))}
            className="text-sm text-sky-500 mt-1">＋ 行を追加</button>
        </Fld>
        <div className="grid grid-cols-2 gap-3">
          <Fld label="一次避難場所"><Inp value={form.ev1} onChange={e=>set("ev1",e.target.value)} placeholder="例：南側駐車場"/></Fld>
          <Fld label="二次避難場所（津波・火災時）"><Inp value={form.ev2} onChange={e=>set("ev2",e.target.value)} placeholder="例：○○小学校3階"/></Fld>
        </div>
        <Fld label="避難経路の特記事項"><Tx value={form.routeNote} onChange={e=>set("routeNote",e.target.value)} placeholder="例：東側非常口は施錠のため不可。車椅子ルートは西側スロープのみ。"/></Fld>
      </div>}

      {/* ── Step 5 ── */}
      {step===5&&<div>
        <div className="text-sm font-medium text-sky-500 mb-1.5">Step 6 / 7</div>
        <div className="text-xl font-bold text-gray-900 mb-1.5">訓練評価と行動変容の記録</div>
        <div className="text-sm text-gray-500 mb-5 leading-relaxed">「訓練をやった」で終わらせないためのPDCA設計です。</div>
        <Fld label="計測・記録する指標（複数選択可）">
          <div className="grid grid-cols-2 gap-1.5">
            {[["避難完了時間（全員）","文科省推奨。目標タイムを設定"],["要配慮者の避難完了時間","一般との差を可視化"],["安否確認完了時間","点呼から全員確認まで"],["前後アンケート（意識変容）","知識・意識・行動意図の変化"],["行動観察記録","担当者がリアルタイム記録"],["写真・動画記録","振り返りワークの素材に"]].map(([v,s])=>(
              <ChkCard key={v} label={v} sub={s} checked={form.kpis.includes(v)} onChange={()=>tog("kpis",v)}/>
            ))}
          </div>
        </Fld>
        <div className="grid grid-cols-2 gap-3">
          <Fld label="避難完了の目標タイム"><Inp value={form.targetT} onChange={e=>set("targetT",e.target.value)} placeholder="例：5分以内"/></Fld>
          <Fld label="前回の実績（あれば）"><Inp value={form.prevT} onChange={e=>set("prevT",e.target.value)} placeholder="例：8分32秒"/></Fld>
        </div>
        <Fld label="振り返りワークの方法">
          <div className="flex flex-wrap gap-2">
            {["当日・全員参加の対話","担当者会議（後日）","書面のみ","実施しない"].map(v=>(
              <Tag key={v} label={v} selected={form.debrief===v} onClick={()=>set("debrief",v)}/>
            ))}
          </div>
        </Fld>
        <Fld label="前回からの改善課題"><Tx value={form.prevIssue} onChange={e=>set("prevIssue",e.target.value)} placeholder="例：要配慮者の誘導に担当者が気づかなかった。今回は専任担当を配置する。"/></Fld>
        <Fld label="今回の訓練後に期待する行動変容（具体的に）" hint="「知識の習得」ではなく「行動の変化」を目標にすることが減災教育2.0の視点">
          <Tx value={form.behavior} onChange={e=>set("behavior",e.target.value)} placeholder="例：訓練後1ヶ月以内に、各担当者が役割カードを常時携帯し、月1回の読み合わせを習慣化する。"/>
        </Fld>
      </div>}

      {/* ── Step 6: 確認 ── */}
      {step===6&&<div>
        <div className="text-sm font-medium text-sky-500 mb-1.5">Step 7 / 7</div>
        <div className="text-lg font-semibold mb-4">入力内容の確認</div>
        {[
          {title:"基本情報",rows:[["組織名",form.orgName||"—"],["訓練日・時間帯",(form.drillDate?form.drillDate.replace(/-/g,"/"):"—")+(form.drillTime?" / "+form.drillTime:"")],["種別・回数",(form.orgType||"—")+(form.drillNum?" / "+form.drillNum:"")],["参加人数・責任者",(form.pcount?form.pcount+"名":"—")+(form.resp?" / "+form.resp:"")]]},
          {title:"複合災害シナリオ",rows:[["第一次災害",form.d1||"—"],["二次災害",form.d2.length?form.d2.join("・"):"単独"],["バイアス対策",form.bias.length?form.bias.join("・"):"未設定"]]},
          {title:"要配慮者・評価",rows:[["要配慮者",form.vuln.length?form.vuln.join("・"):"なし"],["計測指標",form.kpis.length?form.kpis.join("・"):"—"],["行動変容目標",form.behavior?(form.behavior.substring(0,60)+(form.behavior.length>60?"…":"")):"—"]]},
        ].map(s=>(
          <div key={s.title} className="bg-gray-50 rounded-xl border border-gray-200 p-3.5 mb-2.5">
            <div className="text-xs uppercase tracking-widest text-gray-400 mb-2">{s.title}</div>
            {s.rows.map(([k,v])=>(
              <div key={k} className="grid grid-cols-[110px_1fr] text-sm mb-1">
                <dt className="text-gray-400">{k}</dt><dd className="text-gray-700 leading-snug">{v}</dd>
              </div>
            ))}
          </div>
        ))}
        <div className="mt-4 p-4 bg-gradient-to-br from-sky-50 to-indigo-50 rounded-xl border border-sky-200">
          <div className="flex items-start gap-3">
            <div className="text-2xl">💾</div>
            <div>
              <div className="text-sm font-medium text-gray-800 mb-1">Word・Excel・PDFで保存できます</div>
              <div className="text-xs text-gray-500 leading-relaxed">「計画書を完成させる」を押すと、3形式のダウンロード画面に進みます。</div>
            </div>
          </div>
        </div>
      </div>}

      {/* ナビゲーション */}
      <div className="flex justify-between items-center mt-6">
        {step>0
          ? <button onClick={()=>setStep(s=>s-1)} className="text-sm text-gray-500 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50">← 戻る</button>
          : <span/>}
        {isLast
          ? <button onClick={handleComplete}
              className="flex items-center gap-2 text-sm text-white px-5 py-2.5 rounded-lg font-medium bg-green-500 hover:bg-green-600">
              ✓ 計画書を完成させる
            </button>
          : <button onClick={()=>{if(validate())setStep(s=>s+1);}}
              className="text-sm text-white bg-sky-500 hover:bg-sky-600 px-5 py-2 rounded-lg font-medium">
              次へ →
            </button>}
      </div>
    </div>
  );
}
