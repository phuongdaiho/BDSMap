# Ứng dụng Bản đồ Mobile (PWA)

## Tổng quan

Progressive Web App (PWA) cài được trên iOS qua Safari "Thêm vào Màn hình chính". Không cần App Store, không cần tài khoản.

- **File chính:** `Mobile/index.html`
- **Ngôn ngữ giao diện:** Tiếng Việt
- **Thư viện bản đồ:** Leaflet.js v1.9.4
- **Lưu trữ dữ liệu:** Firebase Firestore (cloud, real-time sync, miễn phí)
- **Hosting:** GitHub Pages (HTTPS miễn phí)
- **Deploy:** `git add . && git commit && git push`

---

## Cấu trúc thư mục

```
Mobile/
├── index.html              ← App chính (toàn bộ HTML/CSS/JS)
├── manifest.json           ← Khai báo PWA (tên, màu, icons)
├── sw.js                   ← Service Worker (offline cache, hiện v7)
├── deploy.bat              ← Deploy lên GitHub Pages
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
- **Kéo marker** → tọa độ cập nhật và ghi Firestore ngay lập tức
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
- Mỗi item: màu pin, tên, mô tả, giá dự kiến, số điện thoại (link gọi), tọa độ
- Click item → `map.flyTo()` zoom đến marker, mở popup sau 850ms
- Hover → nút Sửa / Xóa
- Kéo thả sắp xếp thứ tự (chỉ khi không nhóm) → cập nhật `sortOrder` lên Firestore

**Thanh "Thêm địa điểm"** ở đầu sidebar (cùng hàng với tiêu đề):
- **📝 Tự nhập** → đóng sidebar, hiện hint "Click vào bản đồ để thêm"
- **📋 Nhập từ text** → mở panel textarea; dán nội dung BĐS → "🔍 Phân tích & Điền form" → lưu kết quả vào `pendingTextData` → đóng sidebar → hint "Đã phân tích xong — click bản đồ để đặt vị trí" → click map → modal mở với các trường đã điền sẵn

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
- Nhóm khu vực: tự động gọi Nominatim reverse geocoding (1.1s/request), kết quả ghi thẳng lên Firestore

### 6. Thêm / Sửa địa điểm (Modal form)

**Trường cơ bản:**
- Tên * (bắt buộc)
- Mô tả ngắn
- Ghi chú
- Hình ảnh (URL hoặc upload) — có nút "🔍 Trích xuất thông tin" khi có ảnh
- Đường link web
- Số điện thoại liên hệ — nút "📞 Gọi" hiện ngay khi nhập số
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

### 7. OCR — Trích xuất thông tin từ ảnh

Khi có ảnh trong modal, nút **"🔍 Trích xuất thông tin"** xuất hiện ở góc dưới trái preview:

- **Thư viện:** Tesseract.js v5 (lazy-load từ CDN ~1MB, chỉ tải lần đầu nhấn nút)
- **Ngôn ngữ OCR:** Tiếng Việt + Tiếng Anh (`createWorker(['vie', 'eng'], 1)`)
- **Worker singleton:** `ocrWorker` tạo một lần, dùng lại cho các lần sau
- **Chính sách điền:** chỉ điền vào ô **đang trống** — không ghi đè dữ liệu đã nhập

**Thông tin nhận diện được:**

| Trường | Ví dụ OCR nhận diện |
|---|---|
| Hướng | "hướng đông nam", "hướng bắc" |
| Diện tích | "DT: 60m²", "diện tích 80 m2" |
| Ngang × Dài | "4x15m", "4 × 15 m" |
| Giá | "4 tỷ 500 triệu", "4.5 tỷ", "7 ty 500", "800 triệu" |
| Kết cấu | "3 tầng BTCT", "nhà cấp 4", "khung thép" |
| DT xây dựng | "DTXD: 60m²" |
| DT sàn | "DT sàn: 180m²" |
| Công năng | "mặt tiền", "nhà ở", "đất nền" |
| Số điện thoại | "0912 345 678", "+84 912 345 678", "0912.345.678" |

**Price parser (`parsePrice`)** — xử lý các trường hợp đặc biệt:
- `"4 tỷ 500 triệu"` → `4.5 tỷ`
- `"4 tỷ rưỡi"` → `4.5 tỷ`
- `"4 tỷ 5"` → `4.5 tỷ` (shorthand 1 chữ số = ×100 triệu)
- `"4.500 tỷ"` → `4.5 tỷ` (normalize qua parseFloat)
- `"7 ty 500"` → `7.5 tỷ` (OCR bỏ dấu → dùng regex `(?:tỷ|tỉ|ty\b)`)

**Phone parser** — nhận dạng SĐT mobile VN:
- Format 4-3-3: `0[3-9]\d\d[\s.-]?\d{3}[\s.-]?\d{3}`
- Quốc tế: `\+84[\s.-]?[3-9]...` → tự normalize về `0xxxxxxxxx`

### 8. Upload ảnh (trong modal)
Luồng: Chọn file → Canvas nén (≤1200px, JPEG 0.75) → thử upload `telegra.ph` → nếu lỗi thì fallback base64

- Trạng thái hiển thị: ⏳ Đang nén... / ⏳ Đang tải lên... / ✅ Xong / ❌ Lỗi
- Ảnh trên telegra.ph: **công khai, vĩnh viễn**
- Fallback base64: lưu trong field `image`, file XML sẽ lớn hơn

### 9. Popup thông tin marker
- Tên, mô tả, ghi chú, link web, ảnh
- Số điện thoại + nút **"Gọi"** (màu xanh lá, `href="tel:"`) nếu có SĐT
- Bảng thông tin đất (nếu có): hướng, DT, ngang, dài, giá
- Bảng tài sản (nếu có): DT xây dựng, DT sàn, kết cấu, công năng
- Tọa độ (5 chữ số thập phân)
- Nút **Sửa** và **Xóa**
- Nút **🚶 Street View** → mở Google Maps tab mới

### 10. Lưu trữ dữ liệu (Firebase Firestore)

- **Cloud real-time:** mọi thay đổi ghi lên Firestore ngay lập tức
- **Đồng bộ:** `onSnapshot()` lắng nghe — tất cả thiết bị thấy thay đổi tức thì
- **Project:** `bdsmap-3b584` (Firebase free Spark plan)
- **Collection:** `locations` — mỗi document là một địa điểm, ID = `String(Date.now())`
- **Sắp xếp:** theo trường `sortOrder` (số nguyên), fallback `createdAt`, rồi `id`
- **Xuất thủ công:** nút "💾 Lưu XML" → File System Access API hoặc download
- **Import XML:** parse → batch write toàn bộ lên Firestore

**Firebase Security Rules (cần set thủ công sau 30 ngày test mode):**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /locations/{id} {
      allow read, write: if true;
    }
  }
}
```

**Giới hạn free tier (vĩnh viễn):** 50K đọc / 20K ghi / 20K xóa / ngày — đủ cho nhóm nhỏ.

---

## Cấu trúc object địa điểm

```javascript
{
  id,          // Date.now() — dùng làm Firestore doc ID (dạng string)
  lat, lng,    // tọa độ
  name,        // tên *
  desc,        // mô tả ngắn
  note,        // ghi chú
  image,       // URL ảnh hoặc base64
  link,        // đường link web
  phone,       // số điện thoại liên hệ
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
  sortOrder,   // thứ tự hiển thị (idx * 1000 khi kéo thả)
  createdAt,   // timestamp tạo (Date.now())
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
| `db` | `Firestore` | Instance Firestore (firebase.firestore()) |
| `locations` | `Array` | Danh sách địa điểm (sync từ Firestore) |
| `leafletMarkers` | `Object` | Map `id → L.marker` |
| `pendingLatLng` | `Object\|null` | Tọa độ click đang chờ lưu |
| `pendingTextData` | `Object\|null` | Dữ liệu parsed từ "Nhập từ text", chờ click map |
| `editingId` | `number\|null` | ID đang chỉnh sửa |
| `selectedColor` | `string` | Màu hex đang chọn trong modal |
| `sidebarVisible` | `boolean` | Trạng thái drawer (mặc định `false`) |
| `groupByField` | `string` | Trường đang nhóm (`''` = không nhóm) |
| `collapsedGroups` | `Set` | Tập nhóm đang thu gọn |
| `savedFileHandle` | `FileSystemFileHandle\|null` | Handle file XML đã chọn |
| `myLocationMarker` | `L.marker\|null` | Marker vị trí GPS |
| `areaFetchRunning` | `boolean` | Đang chạy reverse geocode |
| `ocrWorker` | `Tesseract.Worker\|null` | Worker OCR singleton (lazy-init) |

---

## Các hàm JS chính

| Hàm | Mục đích |
|---|---|
| `save()` | Render lại markers + sidebar (không còn ghi storage) |
| `renderMarkers()` | Xóa và vẽ lại toàn bộ marker (draggable) |
| `renderSidebar()` | Render danh sách / nhóm trong sidebar |
| `openModal(title, data)` | Mở modal thêm/sửa với data điền sẵn |
| `closeModal()` | Đóng modal, reset state |
| `saveLocation()` | Submit form → ghi Firestore (set mới hoặc update) |
| `flyTo(id)` | Bay đến marker theo id, mở popup |
| `editLocation(id)` | Mở modal sửa |
| `deleteLocation(id)` | Xóa doc Firestore sau confirm |
| `createIcon(color)` | Tạo Leaflet divIcon pin SVG |
| `makePopupHtml(loc)` | Tạo HTML popup (có escape XSS) |
| `toggleSidebar()` | Toggle drawer + backdrop |
| `showHint(text)` | Hiện hint text trên bản đồ trong 3 giây |
| `sidebarAddManual()` | Đóng sidebar + gợi ý click map |
| `toggleTextInput()` | Mở/đóng panel textarea "Nhập từ text" |
| `analyzeAndPrepare()` | Parse text → lưu `pendingTextData` → đóng sidebar |
| `goToMyLocation()` | Đặt icon GPS, di chuyển bản đồ |
| `goToCoords()` | Di chuyển theo Lat/Lng nhập tay |
| `fetchArea(id, lat, lng)` | Nominatim reverse geocode → update `area` trên Firestore |
| `fetchMissingAreas()` | Queue geocode cho các loc thiếu area |
| `compressImage(file)` | Canvas resize+nén → Blob JPEG |
| `uploadImage(blob)` | Upload lên telegra.ph → URL |
| `saveXML()` | Xuất file XML (File System Access API / fallback download) |
| `importXML(event)` | Import XML → batch write lên Firestore |
| `esc(str)` | Escape HTML chống XSS |
| `xmlEsc(str)` | Escape XML |
| `ensureOCR()` | Lazy-load Tesseract.js + tạo worker singleton |
| `extractInfoFromImage()` | Chạy OCR trên URL ảnh, gọi parse + apply |
| `parseRealEstateText(text)` | Trích xuất hướng/DT/ngang/dài/giá/kết cấu/công năng/SĐT |
| `parsePrice(t)` | Parse giá từ text (xử lý "tỷ/triệu/ty", shorthand, normalize) |
| `applyExtractedInfo(result)` | Điền kết quả OCR vào form (chỉ ô trống) |

---

## PWA & Service Worker

- **Cache key:** `bandog-v7` (tăng version khi cần force refresh)
- **Chiến lược cache:**
  - App shell (`index.html`, `manifest.json`, Leaflet): Cache first
  - Network first (không cache): Nominatim, telegra.ph, map tiles, tesseract, tessdata, Firebase/Firestore URLs
  - POST requests: bỏ qua
- **Cập nhật SW:** đổi `CACHE = 'bandog-vN'` trong `sw.js` → push → người dùng tắt/mở lại app

---

## Quy trình deploy

```
Sửa Mobile/index.html
  → git add . && git commit -m "..." && git push
  → chờ GitHub Pages build (~1 phút)
  → kéo xuống refresh trên iPhone
```

Nếu vẫn thấy bản cũ: tăng version cache trong `sw.js`, push lại, xóa app cũ trên iPhone và cài lại.

---

## Lưu ý kỹ thuật

- **XSS:** mọi dữ liệu người dùng qua `esc()` (HTML) hoặc `xmlEsc()` (XML)
- **Firebase Security Rules:** sau 30 ngày test mode phải set rules thủ công (xem mục 10)
- **CORS:** `telegra.ph/upload` hỗ trợ CORS từ browser; Firestore SDK xử lý CORS tự động
- **file:// protocol:** Service Worker không hoạt động từ `file://`, cần HTTPS
- **Nominatim rate limit:** 1 request/giây — debounce 1100ms trong `fetchMissingAreas()`
- **iOS PWA giới hạn:** không có push notification, không có background sync
- **Firestore offline:** SDK tự cache local khi mất mạng, sync lại khi có mạng
