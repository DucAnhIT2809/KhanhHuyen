#!/usr/bin/env node
/**
 * Quét Photofinal → memories-photos.js + cập nhật cache bust trong index.html.
 * Tự copy ảnh Flappy từ photos/ nếu thiếu trong Photofinal.
 * Chạy: node update-memories-photos.cjs
 */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const MEDIA_DIR = path.join(ROOT, "Photofinal");
const PHOTOS_LEGACY = path.join(ROOT, "photos");
const OUT = path.join(ROOT, "memories-photos.js");
const INDEX = path.join(ROOT, "index.html");

function mediaType(file) {
  if (/\.(jpe?g|png|webp|gif)$/i.test(file)) return "image";
  if (/\.(mp4|mov|webm)$/i.test(file)) return "video";
  return null;
}

function ensureFlappyBirdInPhotofinal() {
  if (!fs.existsSync(INDEX)) return;
  const html = fs.readFileSync(INDEX, "utf8");
  const m = html.match(/flappyBirdPhoto:\s*"([^"]+)"/);
  const bird = m?.[1];
  if (!bird) return;
  const dest = path.join(MEDIA_DIR, bird);
  if (fs.existsSync(dest)) return;
  const src = path.join(PHOTOS_LEGACY, bird);
  if (fs.existsSync(src)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
    fs.copyFileSync(src, dest);
    console.log(`Đã copy ảnh chim Flappy → Photofinal/${bird}`);
  } else {
    console.warn(`Cảnh báo: flappyBirdPhoto "${bird}" không có trong Photofinal/ hoặc photos/`);
  }
}

function bumpIndexCache(count) {
  let html = fs.readFileSync(INDEX, "utf8");
  const version = `${count}-${Date.now().toString(36)}`;
  const next = html.replace(
    /(<script\s+src=")memories-photos\.js(?:\?[^"]*)?(")/i,
    `$1memories-photos.js?v=${version}$2`
  );
  if (next === html) {
    console.warn("Không cập nhật được ?v= trong index.html");
    return;
  }
  fs.writeFileSync(INDEX, next);
  console.log(`Đã cập nhật cache: memories-photos.js?v=${version}`);
}

ensureFlappyBirdInPhotofinal();

if (!fs.existsSync(MEDIA_DIR)) {
  console.error("Thiếu thư mục Photofinal/ — tạo thư mục và thêm ảnh/video trước.");
  process.exit(1);
}

const all = fs.readdirSync(MEDIA_DIR);

let media = all
  .map((file) => {
    const type = mediaType(file);
    if (!type) return null;
    const bytes = fs.statSync(path.join(MEDIA_DIR, file)).size;
    return { file, type, bytes };
  })
  .filter(Boolean)
  .sort((a, b) => a.file.localeCompare(b.file, undefined, { sensitivity: "base" }));

const lim = process.env.LIMIT;
if (lim !== undefined && lim !== "") {
  const n = parseInt(lim, 10);
  if (!Number.isNaN(n) && n > 0) media = media.slice(0, n);
}

const skippedHeic = all.filter((f) => /\.heic$/i.test(f)).length;
const imgN = media.filter((m) => m.type === "image").length;
const vidN = media.filter((m) => m.type === "video").length;

const banner = `/* ${media.length} file (${imgN} ảnh, ${vidN} video) — Photofinal — node update-memories-photos.cjs */\n`;
const body = `${banner}window.MEMORIES_MEDIA = ${JSON.stringify(media, null, 2)};\n`;
fs.writeFileSync(OUT, body);

if (fs.existsSync(INDEX)) bumpIndexCache(media.length);

console.log(
  `Đã ghi ${media.length} mục → memories-photos.js (${imgN} ảnh, ${vidN} video; bỏ qua ${skippedHeic} HEIC).`
);
