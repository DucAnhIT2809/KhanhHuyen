#!/usr/bin/env node
/**
 * Quét thư mục photos/, ghi memories-photos.js — chỉ JPG/PNG/WebP/GIF (bỏ HEIC vì nhiều trình duyệt không hiển thị ổn định).
 * Chạy: node update-memories-photos.cjs
 *       LIMIT=50 node update-memories-photos.cjs
 */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PHOTO_DIR = path.join(ROOT, "photos");
const OUT = path.join(ROOT, "memories-photos.js");

const all = fs.existsSync(PHOTO_DIR) ? fs.readdirSync(PHOTO_DIR) : [];
let photos = all
  .filter((f) => /\.(jpe?g|png|webp|gif)$/i.test(f))
  .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

const lim = process.env.LIMIT;
if (lim !== undefined && lim !== "") {
  const n = parseInt(lim, 10);
  if (!Number.isNaN(n) && n > 0) photos = photos.slice(0, n);
}

const skippedHeic = all.filter((f) => /\.heic$/i.test(f)).length;
const banner = `/* ${photos.length} ảnh (web) — HEIC đã bỏ qua (${skippedHeic} file) — node update-memories-photos.cjs */\n`;
fs.writeFileSync(OUT, `${banner}window.MEMORIES_PHOTOS = ${JSON.stringify(photos, null, 2)};\n`);
const totalWeb = all.filter((f) => /\.(jpe?g|png|webp|gif)$/i.test(f)).length;
console.log(`Đã ghi ${photos.length} ảnh vào memories-photos.js (JPG/PNG/WebP/GIF; bỏ qua ${skippedHeic} HEIC; trong photos/ có ${totalWeb} file web).`);
