# 🎣 上海钓鱼标点地图

一个纯静态网页：Leaflet 地图 + 个人钓鱼标点标注，支持缩放、平移、点击查看详情、街道图/卫星图切换，可直接部署到 GitHub Pages，无需服务器、无需 API Key。

## 功能

- 🗺 底图：默认 Esri 街道图（国内可达性好），右上角可切换卫星图；瓦片加载失败会自动回退到其他源
- 🎣 标点：★ 黄色星标 = 毒区钓点，🎣 绿色标记 = 其他钓点；点击标记查看名称/类型/完整描述；左侧列表点击快速定位
- 🌍 外地钓点：左上角「外地」按钮查看非上海市的钓点记录（含完整描述）
- 📍 取坐标：点击地图任意位置，弹出该点坐标和现成的标点代码片段，一键复制
- 🧭 坐标转换：`convert.html` 支持高德/百度坐标 ⇄ WGS84 双向转换
- 📱 移动端适配，手机浏览器可直接使用

## 文件结构

```
fishing-map/
├── index.html          # 地图主页
├── convert.html        # 坐标转换工具（高德/百度 → WGS84）
├── css/style.css       # 样式
├── js/
│   ├── spots.js        # ★ 标点数据（平时只改这个文件）
│   ├── app.js          # 地图逻辑
│   └── gcj02.js        # 坐标转换算法
└── README.md
```

## 本地预览

方式一：直接双击 `index.html`（最简单，功能完整）。

方式二（推荐，模拟线上环境）：

```bash
cd fishing-map
python -m http.server 8000
# 浏览器打开 http://localhost:8000
```

或使用 Node：

```bash
cd fishing-map
npx serve .
```

## 添加标点（三种方式任选）

### 方式一：地图页点击取坐标

1. 打开地图页，直接点击目标位置；
2. 弹出框里点「复制代码片段」；
3. 粘贴到 `js/spots.js` 的数组里，改一下 `name` 即可。

### 方式二：高德/百度坐标转换

1. 在高德地图 App 或网页上长按/右键目标点，复制坐标（注意：高德是 GCJ-02，百度是 BD-09，不能直接使用）；
2. 打开 `convert.html`，选对坐标类型，输入经纬度，转换后复制代码片段；
3. 粘贴到 `js/spots.js`。

### 方式三：直接在电脑上编辑 `js/spots.js`

每行一个标点，格式如下：

```js
{ name: "标点名称", lat: 31.2403, lng: 121.4907, type: "野河", note: "鲫鱼多，好停车" },
{ name: "毒区示例", lat: 31.2403, lng: 121.4907, type: "毒区", note: "注意安全", danger: true },
```

字段说明：

| 字段 | 必填 | 说明 |
| ---- | ---- | ---- |
| `name` | ✅ | 标点名称 |
| `lat` | ✅ | 纬度（WGS84） |
| `lng` | ✅ | 经度（WGS84） |
| `type` | ❌ | 类型，如 野河 / 黑坑 / 湖库 |
| `note` | ❌ | 备注：鱼种、特点、停车等 |
| `danger` | ❌ | `true` 时显示为黄色星标（毒区钓点），默认绿色标记 |

非上海市的钓点不放地图上，写进同文件的 `OTHER_SPOTS` 数组（无坐标，仅记录描述），点击页面左上角「🌍 外地」查看：

```js
window.OTHER_SPOTS = [
  { name: "某地钓点", region: "江苏盐城", note: "完整描述……" },
];
```

## 部署到 GitHub Pages

### 方法 A：网页上传（最简单，适合不熟悉 git）

1. 登录 GitHub，新建仓库（New repository），名字如 `fishing-map`，选 **Public**，不要勾选 README；
2. 进入仓库页面 → **Add file** → **Upload files**，把 `fishing-map` 文件夹里的所有文件（index.html、convert.html、css 文件夹、js 文件夹）拖进去 → **Commit changes**；
3. 仓库页面 → **Settings** → **Pages** → **Build and deployment** 的 Source 选 **Deploy from a branch**，Branch 选 **main** 和 **/ (root)** → **Save**；
4. 等 1–2 分钟，访问 `https://你的用户名.github.io/fishing-map/` 即可。

### 方法 B：git 推送（更新方便）

```bash
cd fishing-map
git init
git add .
git commit -m "init: 上海钓鱼标点地图"
git remote add origin https://github.com/你的用户名/fishing-map.git
git push -u origin main
```

再到仓库 Settings → Pages 里按方法 A 的第 3 步开启 Pages。以后每次改完标点，只需：

```bash
git add js/spots.js
git commit -m "更新标点"
git push
```

## 注意事项

- **坐标必须用 WGS84**：高德/腾讯（GCJ-02）、百度（BD-09）坐标直接使用会偏移几百米，请先用 `convert.html` 转换；
- **数据来源**：当前标点来自 `钓点.docx`，文档只有文字地址没有坐标，坐标为地理编码/估算的"大致位置"，与实际钓点可能有百米级偏差，请按实地情况在 `js/spots.js` 中校正；
- **底图来源**：默认使用 Esri 街道图/卫星图（免费，个人小站适用，需保留地图署名），自动回退源为 OpenStreetMap。如日后标点访问量大，请自行更换商业瓦片服务；
- 地图仅显示公开地理信息，标点数据存放在你自己的仓库里，请勿在备注中填写敏感隐私信息；
- GitHub Pages 在国内偶尔访问不稳定，如遇打不开可稍后重试。
