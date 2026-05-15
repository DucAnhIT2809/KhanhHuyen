#!/usr/bin/env node
/**
 * Nén ảnh/video trong Photofinal/ cho web (GitHub Pages).
 *
 * Ảnh: cạnh dài tối đa 2048px, JPEG quality ~82 (chỉ xử lý file > 1.5 MB hoặc quá lớn).
 * Video: H.264 MP4, cạnh ngang tối đa 1280px, CRF 28.
 *
 * Gốc được lưu vào Photofinal-backup/ (lần đầu mỗi file).
 *
 *   node compress-photofinal.cjs           # nén thật
 *   node compress-photofinal.cjs --dry-run # xem trước, không ghi file
 *   node compress-photofinal.cjs --all     # nén cả file nhỏ (mặc định chỉ file nặng)
 *
 * Sau khi nén: node update-memories-photos.cjs
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = __dirname;
const MEDIA_DIR = path.join(ROOT, "Photofinal");
const BACKUP_DIR = path.join(ROOT, "Photofinal-backup");

const MAX_EDGE = parseInt(process.env.MAX_EDGE || "2048", 10);
const JPEG_QUALITY = parseInt(process.env.JPEG_QUALITY || "82", 10);
const MIN_IMAGE_BYTES = parseFloat(process.env.MIN_IMAGE_MB || "1.5") * 1024 * 1024;
const MIN_VIDEO_BYTES = parseFloat(process.env.MIN_VIDEO_MB || "3") * 1024 * 1024;
const VIDEO_MAX_WIDTH = parseInt(process.env.VIDEO_MAX_WIDTH || "1280", 10);
const VIDEO_CRF = process.env.VIDEO_CRF || "28";

const dryRun = process.argv.includes("--dry-run");
const forceAll = process.argv.includes("--all");

function sh(cmd) {
  return execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
}

function bytesHuman(n) {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

function backupOnce(srcPath, rel) {
  const dest = path.join(BACKUP_DIR, rel);
  if (fs.existsSync(dest)) return;
  if (dryRun) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(srcPath, dest);
}

function sipsSize(filePath) {
  try {
    const out = sh(`sips -g pixelWidth -g pixelHeight ${JSON.stringify(filePath)}`);
    const w = Number(out.match(/pixelWidth:\s*(\d+)/)?.[1] || 0);
    const h = Number(out.match(/pixelHeight:\s*(\d+)/)?.[1] || 0);
    return { w, h };
  } catch {
    return { w: 0, h: 0 };
  }
}

function compressImage(rel) {
  const full = path.join(MEDIA_DIR, rel);
  const before = fs.statSync(full).size;
  const { w, h } = sipsSize(full);
  const maxSide = Math.max(w, h);
  const needsResize = maxSide > MAX_EDGE;
  const needsQuality = before > MIN_IMAGE_BYTES;

  if (!forceAll && !needsResize && !needsQuality) return null;

  const ext = path.extname(rel).toLowerCase();
  const isPng = ext === ".png";
  const outRel = isPng ? rel.replace(/\.png$/i, ".jpg") : rel;
  const outFull = path.join(MEDIA_DIR, outRel);
  const tmp = outFull + ".tmp.jpg";

  if (dryRun) {
    return { rel, outRel, before, after: Math.round(before * (needsResize ? 0.25 : 0.6)), action: "image" };
  }

  backupOnce(full, rel);
  fs.mkdirSync(path.dirname(tmp), { recursive: true });

  sh(
    `sips -Z ${MAX_EDGE} -s format jpeg -s formatOptions ${JPEG_QUALITY} ${JSON.stringify(full)} --out ${JSON.stringify(tmp)}`
  );

  if (!fs.existsSync(tmp) || fs.statSync(tmp).size === 0) {
    fs.existsSync(tmp) && fs.unlinkSync(tmp);
    return null;
  }

  if (isPng && outRel !== rel) {
    fs.renameSync(tmp, outFull);
    fs.unlinkSync(full);
  } else {
    fs.renameSync(tmp, outFull);
  }

  const after = fs.statSync(outFull).size;
  return { rel, outRel, before, after, action: "image" };
}

function compressVideo(rel) {
  const full = path.join(MEDIA_DIR, rel);
  const before = fs.statSync(full).size;
  if (!forceAll && before < MIN_VIDEO_BYTES) return null;

  const outRel = rel.replace(/\.(mov|mp4|webm)$/i, ".mp4");
  const outFull = path.join(MEDIA_DIR, outRel);
  const tmp = outFull + ".tmp.mp4";

  if (dryRun) {
    return { rel, outRel, before, after: Math.round(before * 0.2), action: "video" };
  }

  backupOnce(full, rel);
  try {
    sh(
      `ffmpeg -y -hide_banner -loglevel error -i ${JSON.stringify(full)} ` +
        `-vf "scale='min(${VIDEO_MAX_WIDTH},iw)':-2" -c:v libx264 -crf ${VIDEO_CRF} -preset medium ` +
        `-c:a aac -b:a 128k -movflags +faststart ${JSON.stringify(tmp)}`
    );
  } catch (e) {
    fs.existsSync(tmp) && fs.unlinkSync(tmp);
    console.warn(`Bỏ qua video (lỗi ffmpeg): ${rel}`);
    return null;
  }

  if (!fs.existsSync(tmp)) return null;
  const after = fs.statSync(tmp).size;
  if (after >= before * 0.95) {
    fs.unlinkSync(tmp);
    return null;
  }

  fs.renameSync(tmp, outFull);
  if (outFull !== full) fs.unlinkSync(full);

  return { rel, outRel, before, after, action: "video" };
}

if (!fs.existsSync(MEDIA_DIR)) {
  console.error("Không thấy Photofinal/");
  process.exit(1);
}

try {
  sh("ffmpeg -version");
} catch {
  console.error("Cần cài ffmpeg: brew install ffmpeg");
  process.exit(1);
}

const files = fs.readdirSync(MEDIA_DIR).filter((f) => !f.startsWith("."));
const results = [];
let totalBefore = 0;
let totalAfter = 0;

for (const f of files) {
  const full = path.join(MEDIA_DIR, f);
  if (!fs.statSync(full).isFile()) continue;

  let r = null;
  if (/\.(jpe?g|png)$/i.test(f)) r = compressImage(f);
  else if (/\.(mov|mp4|webm)$/i.test(f)) r = compressVideo(f);

  if (r) {
    results.push(r);
    totalBefore += r.before;
    totalAfter += r.after;
    const renamed = r.outRel !== r.rel ? ` → ${r.outRel}` : "";
    console.log(
      `${dryRun ? "[dry] " : ""}${r.action}: ${r.rel}${renamed}  ${bytesHuman(r.before)} → ${bytesHuman(r.after)}`
    );
  }
}

console.log("");
if (results.length === 0) {
  console.log("Không có file nào cần nén (hoặc dùng --all để nén tất cả).");
} else {
  const saved = totalBefore - totalAfter;
  console.log(
    `${dryRun ? "Ước tính" : "Đã xử lý"} ${results.length} file. ${bytesHuman(totalBefore)} → ${bytesHuman(totalAfter)} (tiết kiệm ~${bytesHuman(saved)})`
  );
  if (!dryRun) {
    console.log(`Backup gốc: Photofinal-backup/`);
    console.log("Chạy tiếp: node update-memories-photos.cjs");
  }
}
