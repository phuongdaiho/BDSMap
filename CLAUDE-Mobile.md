# Ứng dụng Bản đồ Mobile (PWA)

## Tổng quan

Progressive Web App (PWA) cài được trên iOS qua Safari "Thêm vào Màn hình chính". Không cần App Store, không cần tài khoản.

- **File chính:** `Mobile/index.html`
- **Ngôn ngữ giao diện:** Tiếng Việt
- **Thư viện bản đồ:** Leaflet.js v1.9.4
- **Lưu trữ dữ liệu:** `localStorage` (tự động, tồn tại khi tắt/mở lại app)
- **Hosting:** GitHub Pages (HTTPS miễn phí)
- **Deploy:** bấm đúp `deploy.bat`

---

## Cấu trúc thư mục

```
Mobile/
├── index.html              ← App chính (toàn bộ HTML/CSS/JS)
├── manifest.json           ← Khai báo PWA (tên, màu, icons)
├── sw.js                   ← Service Worker (offline cache, hiện v3)
├── deploy.bat              ← Deploy lên GitHub Pages (bấm đúp)
├── sync-from-root.ps1      ← Đồng bộ từ index.html gốc (nếu cần)
├── CLAUDE-Mobile.md        ← File này
└── icons/
    ├── gen-icons.html      ← Mở bằng browser để tạo icon PNG
    ├── apple-touch-icon.png ← 180×180, iOS home screen
    ├── icon-192.png        ← 192×192, PWA manifest
    └── icon-512.png        ← 512×512, PWA manifest
```

---

## Layout giao diện

```
┌──────────────────────────────────────────┐
│  Header (xanh #1a73e8)                   │
│  [🗺️ Bản đồ]        [📋 Địa điểm đã lưu N] │
├──────────────────────────────────────────┤
│  Search bar (flex-wrap, có thể xuống dòng)│
├──────────────────────────────────────────┤
│                                          │
│            Bản đồ (flex:1)               │
│                                          │
└──────────────────────────────────────────┘
  Sidebar drawer (fixed, trượt từ phải vào)
  Backdrop tối (fixed, click để đóng sidebar)
  Modal form (fixed overlay, z-index 5000)
```

### Safe area (iOS notch / Dynamic Island)
Body dùng `padding: env(safe-area-inset-*)` và `height: 100dvh` để tránh nội dung bị che.

---

## Tile layers bản đồ

| Tên | Nguồn | Ghi chú |
|---|---|---|
| 🗺️ Bản đồ | OpenStreetMap | Mặc định khi mở |
| 🛰️ Vệ tinh | ESRI World Imagery | Miễn phí, không cần key |
| 🛰️ Vệ tinh + đường | ESRI + OSM overlay 0.45 | Kết hợp |

Layer control góc trên phải, `collapsed: false`.

---

## Tính năng

### 1. Bản đồ
- **Click** vào bản đồ → mở modal thêm địa điểm
- **Kéo marker** → tọa độ cập nhật ngay, tự lưu localStorage
- **Chuột phải / long-press** → popup Street View (mở Google Maps tab mới)
- **Vị trí tôi** → icon chấm xanh pulse tại GPS, hiện popup tọa độ

### 2. Tìm kiếm (Nominatim)
- Gợi ý tự động sau 400ms khi gõ ≥ 3 ký tự
- Kết quả trả về tiếng Việt (`accept-language=vi`)
- Chỉ di chuyển bản đồ, **không tự thêm marker**
- Nhấn Escape đóng dropdown

### 3. Tìm kiếm theo tọa độ
- 2 ô nhập Lat/Lng → nút "Đến tọa độ" → `map.setView([lat, lng], 15)`

### 4. Sidebar danh sách (Drawer)
- Nút header "📋 Địa điểm đã lưu N" → trượt drawer từ phải vào
- Backdrop tối phủ bản đồ → click backdrop để đóng
- Animation: `transform: translateX` + `cubic-bezier(0.4,0,0.2,1)` 300ms
- Mặc định **ẩn** khi khởi động
- Mỗi item: màu pin, tên, mô tả, giá dự kiến, tọa độ
- Click item → `map.flyTo()` zoom đến marker, mở popup sau 850ms
- Hover → nút Sửa / Xóa
- Kéo thả sắp xếp thứ tự (chỉ khi không nhóm)

### 5. Nhóm địa điểm trong sidebar
Dropdown "☰ Danh sách" cho phép nhóm theo:

| Tùy chọn | Trường nhóm |
|---|---|
| ☰ Danh sách | Không nhóm |
| 📍 Khu vực | `area` (Nominatim reverse geocode) |
| 🧭 Hướng | `direction` |
| 🏠 Công năng | `usage` |
| 🏗️ Kết cấu | `structure` |
| 🎨 Màu marker | `color` |
| 💰 Giá dự kiến | `price` |

- Header nhóm có thể click để thu gọn / mở ra
- Nhóm khu vực: tự động gọi Nominatim reverse geocoding (1.1s/request)

### 6. Thêm / Sửa địa điểm (Modal form)

**Trường cơ bản:**
- Tên * (bắt buộc)
- Mô tả ngắn
- Ghi chú
- Hình ảnh (URL hoặc upload)
- Đường link web
- Màu marker (5 màu)
- Tọa độ (readonly, tự điền)

**Trường Thông tin đất:**
- Hướng (dropdown: 8 hướng)
- Diện tích (m²)
- Chiều ngang (m) / Chiều dài (m)
- Giá trị dự kiến

**Trường Tài sản gắn liền trên đất:**
- Diện tích xây dựng (m²)
- Diện tích sàn (m²)
- Kết cấu
- Công năng

### 7. Upload ảnh (trong modal)
Luồng: Chọn file → Canvas nén (≤1200px, JPEG 0.75) → thử upload `telegra.ph` → nếu lỗi CORS/mạng thì fallback base64

- Trạng thái hiển thị: ⏳ Đang nén... / ⏳ Đang tải lên... / ✅ Xong / ❌ Lỗi
- Ảnh trên telegra.ph: **công khai, vĩnh viễn**
- Fallback base64: lưu trong XML/localStorage, file XML sẽ lớn hơn

### 8. Popup thông tin marker
- Tên, mô tả, ghi chú, link web, ảnh
- Bảng thông tin đất (nếu có): hướng, DT, ngang, dài, giá
- Bảng tài sản (nếu có): DT xây dựng, DT sàn, kết cấu, công năng
- Tọa độ (5 chữ số thập phân)
- Nút **Sửa** và **Xóa**
- Nút **🚶 Street View** → mở Google Maps tab mới

### 9. Lưu trữ dữ liệu
- **Tự động:** mọi thay đổi → `localStorage` (`map_locations`) ngay lập tức
- **Khởi động:** load từ `localStorage` trước, fallback `fetch('./data.xml')`
- **Xuất thủ công:** nút "💾 Lưu XML" → chọn đường dẫn lưu (File System Access API trên Chrome/Edge) hoặc tải xuống (fallback)
- **Import:** nút "📂 Mở XML" → parse XML → lưu vào localStorage

---

## Cấu trúc object địa điểm

```javascript
{
  id,          // Date.now()
  lat, lng,    // tọa độ
  name,        // tên *
  desc,        // mô tả ngắn
  note,        // ghi chú
  image,       // URL ảnh hoặc base64
  link,        // đường link web
  color,       // hex màu marker
  area,        // khu vực (Nominatim reverse geocode)
  direction,   // hướng
  acreage,     // diện tích (m²)
  width,       // chiều ngang (m)
  length,      // chiều dài (m)
  price,       // giá trị dự kiến
  buildArea,   // DT xây dựng (m²)
  floorArea,   // DT sàn (m²)
  structure,   // kết cấu
  usage,       // công năng
}
```

---

## Màu marker (5 lựa chọn)

| Tên | Hex |
|---|---|
| Đỏ (mặc định) | `#e53935` |
| Xanh lam | `#1a73e8` |
| Xanh lá | `#43a047` |
| Cam | `#f57c00` |
| Tím | `#8e24aa` |

Marker: hình pin SVG 28×36px, có vòng tròn trắng ở giữa, dùng `L.divIcon`.

---

## Biến trạng thái JS

| Biến | Kiểu | Mô tả |
|---|---|---|
| `STORAGE_KEY` | `string` | `'map_locations'` |
| `locations` | `Array` | Danh sách địa điểm |
| `leafletMarkers` | `Object` | Map `id → L.marker` |
| `pendingLatLng` | `Object\|null` | Tọa độ click đang chờ lưu |
| `editingId` | `number\|null` | ID đang chỉnh sửa |
| `selectedColor` | `string` | Màu hex đang chọn trong modal |
| `sidebarVisible` | `boolean` | Trạng thái drawer (mặc định `false`) |
| `groupByField` | `string` | Trường đang nhóm (`''` = không nhóm) |
| `collapsedGroups` | `Set` | Tập nhóm đang thu gọn |
| `savedFileHandle` | `FileSystemFileHandle\|null` | Handle file XML đã chọn |
| `myLocationMarker` | `L.marker\|null` | Marker vị trí GPS |
| `areaFetchRunning` | `boolean` | Đang chạy reverse geocode |

---

## Các hàm JS chính

| Hàm | Mục đích |
|---|---|
| `saveToStorage()` | Lưu `locations` vào localStorage |
| `loadFromStorage()` | Load từ localStorage, trả về `true` nếu có data |
| `save()` | `saveToStorage` + render lại markers + sidebar |
| `renderMarkers()` | Xóa và vẽ lại toàn bộ marker (draggable) |
| `renderSidebar()` | Render danh sách / nhóm trong sidebar |
| `openModal(title, data)` | Mở modal thêm/sửa với data điền sẵn |
| `closeModal()` | Đóng modal, reset state |
| `saveLocation()` | Submit form thêm mới hoặc cập nhật |
| `flyTo(id)` | Bay đến marker theo id, mở popup |
| `editLocation(id)` | Mở modal sửa |
| `deleteLocation(id)` | Xóa sau confirm |
| `createIcon(color)` | Tạo Leaflet divIcon pin SVG |
| `makePopupHtml(loc)` | Tạo HTML popup (có escape XSS) |
| `toggleSidebar()` | Toggle drawer + backdrop |
| `goToMyLocation()` | Đặt icon GPS, di chuyển bản đồ |
| `goToCoords()` | Di chuyển theo Lat/Lng nhập tay |
| `fetchArea(loc)` | Nominatim reverse geocode → `loc.area` |
| `fetchMissingAreas()` | Queue geocode cho các loc thiếu area |
| `compressImage(file)` | Canvas resize+nén → Blob JPEG |
| `uploadImage(blob)` | Upload lên telegra.ph → URL |
| `saveXML()` | Xuất file XML (File System Access API / fallback download) |
| `importXML(event)` | Import XML → parse → saveToStorage + render |
| `esc(str)` | Escape HTML chống XSS |
| `xmlEsc(str)` | Escape XML |

---

## PWA & Service Worker

- **Cache key:** `bandog-v3` (tăng version khi cần force refresh)
- **Chiến lược cache:**
  - App shell (`index.html`, `manifest.json`, Leaflet): Cache first
  - Nominatim / telegra.ph / map tiles: Network first, cache fallback
  - POST requests: bỏ qua (không cache)
- **Cập nhật SW:** đổi `CACHE = 'bandog-vN'` trong `sw.js` → push → người dùng xóa app cũ cài lại

---

## Quy trình deploy

```
Sửa Mobile/index.html
  → bấm đúp deploy.bat
  → chờ GitHub Actions ✅ (~1 phút)
  → kéo xuống refresh trên iPhone
```

Nếu vẫn thấy bản cũ: tăng version cache trong `sw.js`, push lại, xóa app cũ trên iPhone và cài lại.

---

## Lưu ý kỹ thuật

- **XSS:** mọi dữ liệu người dùng qua `esc()` (HTML) hoặc `xmlEsc()` (XML)
- **CORS:** `telegra.ph/upload` hỗ trợ CORS từ browser; catbox.moe thì không
- **file:// protocol:** Service Worker không hoạt động từ `file://`, cần HTTPS
- **localStorage giới hạn:** ~5–10MB tùy browser; ảnh base64 lớn có thể vượt giới hạn
- **Nominatim rate limit:** 1 request/giây — debounce 1100ms trong `fetchMissingAreas()`
- **iOS PWA giới hạn:** không có push notification, không có background sync
