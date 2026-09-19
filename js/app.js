/* 上海钓鱼标点地图 —— 地图逻辑 */
(function () {
  "use strict";

  // 上海市中心附近，初始视野
  const CENTER = [31.2304, 121.4737];
  const DEFAULT_ZOOM = 11;

  // 初始化地图
  const map = L.map("map", { zoomControl: true }).setView(CENTER, DEFAULT_ZOOM);

  // ---------- 底图图层（主源 Esri：国内可达性好；OSM 作为最后回退） ----------
  const baseLayers = {
    street: L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom',
      }
    ),
    satellite: L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      }
    ),
    osm: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }),
  };

  let currentBase = null;
  let currentName = "street";
  let tileErrorCount = 0;
  let autoSwitchCount = 0; // 连续自动切换次数（防止全部源不可用时死循环）
  const layerBtn = document.getElementById("btn-layer");

  function nextName(fromName) {
    if (fromName === "street") return "satellite";
    if (fromName === "satellite") return "osm";
    return "street";
  }

  function setBase(name) {
    if (currentBase) map.removeLayer(currentBase);
    currentBase = baseLayers[name];
    currentBase.addTo(map);
    currentName = name;
    tileErrorCount = 0;
  }

  // 瓦片加载失败：连续失败 5 次自动切换下一个源；试过 3 个源仍失败则停止
  function onTileError(name) {
    return function () {
      if (name !== currentName) return; // 非当前激活图层，忽略
      tileErrorCount++;
      if (tileErrorCount >= 5 && autoSwitchCount < 3) {
        autoSwitchCount++;
        setBase(nextName(name));
        updateLayerBtn();
      }
    };
  }
  baseLayers.street.on("tileerror", onTileError("street"));
  baseLayers.satellite.on("tileerror", onTileError("satellite"));
  baseLayers.osm.on("tileerror", onTileError("osm"));

  function updateLayerBtn() {
    layerBtn.textContent = (currentName === "street") ? "🛰 卫星图" : "🗺 街道图";
  }
  layerBtn.addEventListener("click", function () {
    autoSwitchCount = 0; // 手动切换重置自动切换计数
    setBase(currentName === "street" ? "satellite" : "street");
    updateLayerBtn();
  });

  // 初始底图：街道图（默认）→ 失败自动切卫星图 → 再失败切 OSM
  setBase("street");
  updateLayerBtn();

  // 自定义标点图标：毒区 = 黄色星标 ★；其他 = 绿色标记 🎣
  function makeSpotIcon(cls, glyph) {
    return L.divIcon({
      className: "spot-marker",
      html: '<div class="spot-pin ' + cls + '">' + glyph + "</div>",
      iconSize: [34, 42],
      iconAnchor: [17, 40],
      popupAnchor: [0, -36],
    });
  }
  const dangerIcon = makeSpotIcon("spot-pin-danger", "★");
  const normalIcon = makeSpotIcon("spot-pin-normal", "🎣");

  const tempIcon = L.divIcon({
    className: "temp-marker",
    html: '<div class="temp-pin">📍</div>',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

  const spotLayer = L.layerGroup().addTo(map);

  // ---------- 数据规范化（防止填错数据导致整页出错） ----------
  function normalizeSpots() {
    return (window.FISHING_SPOTS || []).map(function (s) {
      return {
        name: (s && s.name) ? String(s.name) : "未命名标点",
        lat: Number(s.lat),
        lng: Number(s.lng),
        type: (s && s.type) ? String(s.type) : "",
        note: (s && s.note) ? String(s.note) : "",
        danger: !!(s && s.danger),
      };
    }).filter(function (s) { return isFinite(s.lat) && isFinite(s.lng); });
  }

  // ---------- 侧边栏列表 ----------
  const listEl = document.getElementById("spot-list");
  const countEl = document.getElementById("spot-count");

  function renderList() {
    const spots = normalizeSpots();
    countEl.textContent = "(" + spots.length + ")";
    listEl.innerHTML = "";
    spots.forEach(function (spot, i) {
      const li = document.createElement("li");
      li.className = "spot-item";

      const titleRow = document.createElement("div");
      titleRow.className = "spot-item-title-row";

      if (spot.danger) {
        const badge = document.createElement("span");
        badge.className = "badge badge-danger";
        badge.textContent = "毒区";
        titleRow.appendChild(badge);
      }

      const title = document.createElement("span");
      title.className = "spot-item-title";
      title.textContent = spot.name;
      titleRow.appendChild(title);

      const meta = document.createElement("div");
      meta.className = "spot-item-meta";
      let metaText = "";
      if (spot.type) metaText += "「" + spot.type + "」";
      if (spot.note) metaText += (metaText ? " · " : "") + spot.note;
      meta.textContent = metaText;

      li.appendChild(titleRow);
      li.appendChild(meta);
      li.addEventListener("click", function () { flyToSpot(i); });
      listEl.appendChild(li);
    });
  }

  // ---------- 渲染标点 ----------
  const markers = [];
  function renderSpots() {
    const spots = normalizeSpots();
    markers.forEach(function (m) { spotLayer.removeLayer(m); });
    markers.length = 0;

    spots.forEach(function (spot, i) {
      const marker = L.marker([spot.lat, spot.lng], { icon: spot.danger ? dangerIcon : normalIcon })
        .bindPopup(spotPopupHtml(spot, i));
      marker.addTo(spotLayer);
      markers.push(marker);
    });
  }

  function spotPopupHtml(spot, i) {
    const parts = ["<div class='popup-box'>", "<h3>" + esc(spot.name) + "</h3>"];
    if (spot.danger) parts.push('<p class="popup-danger">⚠ 毒区钓点</p>');
    if (spot.type) parts.push('<p class="popup-type">类型：' + esc(spot.type) + "</p>");
    parts.push('<p class="popup-coord">坐标：' + spot.lat.toFixed(6) + ", " + spot.lng.toFixed(6) + "</p>");
    if (spot.note) parts.push('<p class="popup-note">' + esc(spot.note) + "</p>");
    parts.push("</div>");
    return parts.join("");
  }

  function flyToSpot(i) {
    const spot = normalizeSpots()[i];
    if (!spot) return;
    map.flyTo([spot.lat, spot.lng], Math.max(map.getZoom(), 15), { duration: 0.8 });
    setTimeout(function () { markers[i] && markers[i].openPopup(); }, 850);
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ---------- 点击地图取坐标（方便添加新标点） ----------
  let tempMarker = null;
  map.on("click", function (e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    if (tempMarker) map.removeLayer(tempMarker);
    tempMarker = L.marker([lat, lng], { icon: tempIcon }).addTo(map);

    const coordPart = "lat: " + lat.toFixed(6) + ", lng: " + lng.toFixed(6);
    const snippetNormal = "{ name: \"标点名称\", " + coordPart + ", type: \"野河\", note: \"\" },";
    const snippetDanger = "{ name: \"标点名称\", " + coordPart + ", danger: true, type: \"毒区\", note: \"\" },";

    const popup = L.popup()
      .setLatLng(e.latlng)
      .setContent(
        '<div class="popup-box">' +
        "<h3>此点坐标</h3>" +
        '<p class="popup-coord">' + lat.toFixed(6) + ", " + lng.toFixed(6) + "</p>" +
        '<textarea readonly rows="2" class="snippet" id="snippet">' + esc(snippetNormal) + "</textarea>" +
        '<label class="chk-line"><input type="checkbox" id="chk-danger" /> 毒区标点（黄色星标 ★）</label>' +
        '<button class="btn btn-primary btn-copy" id="btn-copy">复制代码片段</button>' +
        "</div>"
      )
      .openOn(map);

    popup.on("remove", function () {
      if (tempMarker) { map.removeLayer(tempMarker); tempMarker = null; }
    });

    // 延迟绑定复制按钮与毒区勾选（popup 内容异步插入 DOM）
    setTimeout(function () {
      const btn = document.getElementById("btn-copy");
      const chk = document.getElementById("chk-danger");
      const ta = document.getElementById("snippet");
      if (chk && ta) {
        chk.addEventListener("change", function () {
          ta.value = chk.checked ? snippetDanger : snippetNormal;
        });
      }
      if (btn) {
        btn.addEventListener("click", function () {
          copyText(ta ? ta.value : "");
          btn.textContent = "已复制 ✔";
          setTimeout(function () { btn.textContent = "复制代码片段"; }, 1500);
        });
      }
    }, 50);
  });

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () { fallbackCopy(text); });
    } else {
      fallbackCopy(text);
    }
  }
  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (err) { /* 忽略 */ }
    document.body.removeChild(ta);
  }

  // ---------- URL 参数定位（?lat=&lng=&name= 分享/定位） ----------
  const qs = new URLSearchParams(window.location.search);
  const qLat = parseFloat(qs.get("lat"));
  const qLng = parseFloat(qs.get("lng"));
  if (!isNaN(qLat) && !isNaN(qLng)) {
    const qName = qs.get("name") || "目标点";
    const m = L.marker([qLat, qLng], { icon: tempIcon }).addTo(map);
    m.bindPopup("<h3>" + esc(qName) + "</h3>").openPopup();
    map.setView([qLat, qLng], 16);
  }

  // ---------- 侧边栏开关 / 说明弹窗 ----------
  const sidebar = document.getElementById("sidebar");
  document.getElementById("toggle-list").addEventListener("click", function () {
    sidebar.classList.toggle("open");
  });
  document.getElementById("btn-close-list").addEventListener("click", function () {
    sidebar.classList.remove("open");
  });

  const helpMask = document.getElementById("help-mask");
  document.getElementById("btn-help").addEventListener("click", function () {
    helpMask.classList.remove("hidden");
  });
  document.getElementById("btn-close-help").addEventListener("click", function () {
    helpMask.classList.add("hidden");
  });
  helpMask.addEventListener("click", function (e) {
    if (e.target === helpMask) helpMask.classList.add("hidden");
  });

  // ---------- 外地钓点列表（不标注在地图上） ----------
  const otherMask = document.getElementById("other-mask");
  const otherListEl = document.getElementById("other-list");

  function renderOtherList() {
    const others = window.OTHER_SPOTS || [];
    otherListEl.innerHTML = "";
    if (!others.length) {
      const li = document.createElement("li");
      li.className = "other-item other-empty";
      li.textContent = "暂无外地钓点记录";
      otherListEl.appendChild(li);
      return;
    }
    others.forEach(function (o) {
      const li = document.createElement("li");
      li.className = "other-item";

      const head = document.createElement("div");
      head.className = "other-item-head";

      const name = document.createElement("span");
      name.className = "other-item-title";
      name.textContent = o.name || "未命名";

      const region = document.createElement("span");
      region.className = "badge badge-other";
      region.textContent = o.region || "外地";

      head.appendChild(name);
      head.appendChild(region);

      const note = document.createElement("div");
      note.className = "other-item-note";
      note.textContent = o.note || "";

      li.appendChild(head);
      li.appendChild(note);
      otherListEl.appendChild(li);
    });
  }

  document.getElementById("btn-other").addEventListener("click", function () {
    otherMask.classList.remove("hidden");
  });
  document.getElementById("btn-close-other").addEventListener("click", function () {
    otherMask.classList.add("hidden");
  });
  otherMask.addEventListener("click", function (e) {
    if (e.target === otherMask) otherMask.classList.add("hidden");
  });

  // 首次进入
  renderList();
  renderSpots();
  renderOtherList();
})();
