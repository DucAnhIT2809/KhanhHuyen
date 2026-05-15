# KhanhHuyen

Trang tĩnh gửi Khánh Huyền — album ảnh/video trong `Photofinal/`.

## Chạy trên máy (local)

```bash
cd /Users/ducanh/Documents/Websn   # thư mục có index.html
node update-memories-photos.cjs     # sau khi thêm/xóa file trong Photofinal/
python3 -m http.server 8080
```

Mở trình duyệt: **http://localhost:8080/** (không double-click `index.html`).

Nếu ảnh vẫn lỗi: hard refresh **Cmd+Shift+R** (tránh cache `memories-photos.js` cũ).

## Giảm dung lượng ảnh & video (nén cho web)

Thư mục `Photofinal/` hiện ~450MB — nén trước khi push GitHub sẽ nhanh và ổn định hơn.

```bash
# Xem trước (không ghi đè)
node compress-photofinal.cjs --dry-run

# Nén thật — gốc lưu vào Photofinal-backup/
node compress-photofinal.cjs

# Cập nhật danh sách (nếu PNG đổi thành .jpg hoặc MOV → .mp4)
node update-memories-photos.cjs
```

| Loại | Cách nén (mặc định) |
|------|---------------------|
| Ảnh JPG/PNG | Cạnh dài tối đa **2048px**, JPEG quality **82** (file > 1.5 MB hoặc quá lớn) |
| Video MOV/MP4 | **MP4** H.264, rộng tối đa **1280px**, CRF **28** |

Tùy chỉnh: `MAX_EDGE=1920 JPEG_QUALITY=80 node compress-photofinal.cjs`

**Cách khác (thủ công):** xuất ảnh từ iPhone/Meitu ở chế độ “Web / nhỏ”; video dùng [HandBrake](https://handbrake.fr/) preset “Fast 1080p30”; hoặc kéo thả folder vào [Squoosh](https://squoosh.app/).

## Thêm ảnh / video mới

1. Copy file vào `Photofinal/` (jpg, png, mov, mp4 — không dùng `.heic` trên web).
2. Chạy `node update-memories-photos.cjs` (cập nhật danh sách + `?v=` cache trong `index.html`).
3. Reload trang.

## Deploy lên GitHub Pages

```bash
node update-memories-photos.cjs
git add Photofinal/ memories-photos.js index.html update-memories-photos.cjs README.md
git commit -m "Deploy album Photofinal"
git push origin main
```

Site: https://ducanhit2809.github.io/KhanhHuyen/

**Lưu ý:** thư mục `Photofinal/` phải được commit (repo ~450MB vì có vài video MOV). Push có thể mất vài phút.

## Cấu trúc

| File / thư mục | Vai trò |
|----------------|---------|
| `index.html` | Trang chính, `photoDir: "Photofinal"` |
| `memories-photos.js` | Danh sách `MEMORIES_MEDIA` (tự sinh, không sửa tay) |
| `Photofinal/` | Ảnh + video album |
| `photos/` | Bản cũ (không dùng trên trang nữa) |
| `update-memories-photos.cjs` | Quét Photofinal và ghi lại manifest |
