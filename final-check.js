// 临时：最终综合验证（运行后删除）
const fs = require("fs");
const path = require("path");
const ROOT = __dirname;
globalThis.window = globalThis;
let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? "PASS" : "FAIL") + " | " + name + (detail ? " | " + detail : ""));
  if (!ok) failures++;
}

// 1. HTML 引用完整性
for (const page of ["index.html", "convert.html"]) {
  const html = fs.readFileSync(path.join(ROOT, page), "utf8");
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1])
    .filter(u => !/^(https?:|data:)/.test(u));
  for (const ref of refs) {
    const p = path.join(ROOT, ref.split(/[?#]/)[0]);
    check(`${page} 引用 ${ref}`, fs.existsSync(p));
  }
}

// 2. HTML id 与 app.js getElementById 一致性
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const app = fs.readFileSync(path.join(ROOT, "js", "app.js"), "utf8");
const htmlIds = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
const jsIds = [...app.matchAll(/getElementById\("([^"]+)"\)/g)].map(m => m[1]);
for (const id of jsIds) {
  const isDynamic = ["btn-copy", "snippet", "chk-danger"].includes(id); // popup 动态生成
  if (isDynamic) continue;
  check(`app.js 使用 #${id}（index.html 中存在）`, htmlIds.has(id));
}

// 3. 数据验证
eval(fs.readFileSync(path.join(ROOT, "js", "spots.js"), "utf8"));
const spots = window.FISHING_SPOTS;
const others = window.OTHER_SPOTS;
check("FISHING_SPOTS 是数组且非空", Array.isArray(spots) && spots.length > 0, spots.length + " 条");
check("OTHER_SPOTS 是数组且非空", Array.isArray(others) && others.length > 0, others.length + " 条");
const inSh = (s) => s.lat > 30.5 && s.lat < 32.2 && s.lng > 120.5 && s.lng < 122.5;
let dataOk = true;
spots.forEach((s, i) => {
  const ok = s && typeof s.name === "string" && isFinite(Number(s.lat)) && isFinite(Number(s.lng)) &&
    inSh({ lat: Number(s.lat), lng: Number(s.lng) }) &&
    typeof s.note === "string" && s.note.length > 0;
  if (!ok) { check(`标点 ${i}「${s && s.name}」字段完整且在上海范围内`, false); dataOk = false; }
});
check("全部标点字段完整且坐标在上海范围内", dataOk);
const dangerCount = spots.filter(s => s.danger).length;
check("毒区标点数量 > 0（黄色星标）", dangerCount > 0, dangerCount + " 个");
check("普通标点数量 > 0（绿色标记）", spots.length - dangerCount > 0, (spots.length - dangerCount) + " 个");
others.forEach((o, i) => {
  const ok = o && typeof o.name === "string" && typeof o.region === "string" && typeof o.note === "string";
  if (!ok) check(`外地钓点 ${i} 字段完整`, false);
});

console.log(failures === 0 ? "\n全部验证通过 ✔" : `\n${failures} 项失败 ✘`);
process.exit(failures ? 1 : 0);
