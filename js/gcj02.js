/* 国内地图坐标系转换工具函数（公开标准算法）
 * GCJ-02：高德/腾讯地图；BD-09：百度地图；WGS84：国际标准（OSM/Leaflet 使用）
 */
(function (global) {
  "use strict";

  const PI = Math.PI;
  const A = 6378245.0;            // 长半轴
  const EE = 0.00669342162296594323; // 偏心率平方

  function outOfChina(lng, lat) {
    return (lng < 72.004 || lng > 137.8347) || (lat < 0.8293 || lat > 55.8271);
  }

  function transformLat(x, y) {
    let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
    ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0;
    ret += (160.0 * Math.sin(y / 12.0 * PI) + 320.0 * Math.sin(y * PI / 30.0)) * 2.0 / 3.0;
    return ret;
  }

  function transformLng(x, y) {
    let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
    ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(x * PI) + 40.0 * Math.sin(x / 3.0 * PI)) * 2.0 / 3.0;
    ret += (150.0 * Math.sin(x / 12.0 * PI) + 300.0 * Math.sin(x / 30.0 * PI)) * 2.0 / 3.0;
    return ret;
  }

  function delta(lng, lat) {
    let dLat = transformLat(lng - 105.0, lat - 35.0);
    let dLng = transformLng(lng - 105.0, lat - 35.0);
    const radLat = lat / 180.0 * PI;
    let magic = Math.sin(radLat);
    magic = 1 - EE * magic * magic;
    const sqrtMagic = Math.sqrt(magic);
    dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * PI);
    dLng = (dLng * 180.0) / (A / sqrtMagic * Math.cos(radLat) * PI);
    return { lat: dLat, lng: dLng };
  }

  // WGS84 → GCJ-02
  function wgs84ToGcj02(lng, lat) {
    if (outOfChina(lng, lat)) return { lng: lng, lat: lat };
    const d = delta(lng, lat);
    return { lng: lng + d.lng, lat: lat + d.lat };
  }

  // GCJ-02 → WGS84（迭代近似逆变换，精度约 1 米内）
  function gcj02ToWgs84(lng, lat) {
    if (outOfChina(lng, lat)) return { lng: lng, lat: lat };
    let wgsLng = lng;
    let wgsLat = lat;
    for (let i = 0; i < 6; i++) {
      const g = wgs84ToGcj02(wgsLng, wgsLat);
      wgsLng = wgsLng - (g.lng - lng);
      wgsLat = wgsLat - (g.lat - lat);
    }
    return { lng: wgsLng, lat: wgsLat };
  }

  // BD-09 → GCJ-02
  function bd09ToGcj02(lng, lat) {
    const x = lng - 0.0065;
    const y = lat - 0.006;
    const z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * 3000.0 * PI / 180.0);
    const theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * 3000.0 * PI / 180.0);
    return { lng: z * Math.cos(theta), lat: z * Math.sin(theta) };
  }

  // GCJ-02 → BD-09
  function gcj02ToBd09(lng, lat) {
    const x = lng;
    const y = lat;
    const z = Math.sqrt(x * x + y * y) + 0.00002 * Math.sin(y * 3000.0 * PI / 180.0);
    const theta = Math.atan2(y, x) + 0.000003 * Math.cos(x * 3000.0 * PI / 180.0);
    return { lng: z * Math.cos(theta) + 0.0065, lat: z * Math.sin(theta) + 0.006 };
  }

  global.CoordConv = {
    wgs84ToGcj02: wgs84ToGcj02,
    gcj02ToWgs84: gcj02ToWgs84,
    bd09ToGcj02: bd09ToGcj02,
    gcj02ToBd09: gcj02ToBd09,
    bd09ToWgs84: function (lng, lat) {
      const gcj = bd09ToGcj02(lng, lat);
      return gcj02ToWgs84(gcj.lng, gcj.lat);
    },
    wgs84ToBd09: function (lng, lat) {
      const gcj = wgs84ToGcj02(lng, lat);
      return gcj02ToBd09(gcj.lng, gcj.lat);
    },
  };
})(window);
