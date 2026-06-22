# Ứng dụng Bản đồ Mobile (PWA)

## Tổng quan

Progressive Web App (PWA) cài được trên iOS qua Safari "Thêm vào Màn hình chính". Không cần App Store.

- **File chính:** `Mobile/index.html` (toàn bộ HTML/CSS/JS trong một file)
- **Ngôn ngữ giao diện:** Tiếng Việt
- **Thư viện bản đồ:** Leaflet.js v1.9.4 + Leaflet.markercluster v1.5.3
- **Thư viện self-hosted:** `lib/` (không phụ thuộc CDN)
- **Lưu trữ dữ liệu:** Firebase Firestore (cloud, real-time sync, miễn phí)
- **Auth:** Firebase Auth (email/password) + Guest mode (localStorage)
- **Hosting:** GitHub Pages — `https://phuongdaiho.github.io/BDSMap/`
- **Deploy:** `git add . && git commit -m "..." && git push`

---

## Cấu trúc thư mục

```
Mobile/
├── index.html              ← App chính (toàn bộ HTML/CSS/JS)
├── manifest.json           ← Khai báo PWA (tên, màu, icons)
├── sw.js                   ← Service Worker (offline cache, hiện v9)
├── CLAUDE-Mobile.md        ← File này
├── lib/                    ← Thư viện self-hosted (không dùng CDN)
│   ├── leaflet.css
│   ├── leaflet.js
│   ├── MarkerCluster.css
│   ├── MarkerCluster.Default.css
│   └── leaflet.markercluster.min.js
└── icons/
    ├── gen-icons.html      ← Mở bằng browser để tạo icon PNG
    ├── apple-touch-icon.png ← 180×180, iOS home screen
    ├── icon-192.png        ← 192×192, PWA manifest
    └── icon-512.png        ← 512×512, PWA manifest
```

---

## Layout giao diện

```
┌──────────────────────────────────────────────┐
│  Header (xanh #1a73e8)                       │
│  [🗺️ Bản đồ]  [● Khách]  [📋 Địa điểm N]   │
├──────────────────────────────────────────────┤
│  Search bar                                   │
│  [ô tìm kiếm] [Tìm] [📍 Vị trí tôi]        │
│  [🌍 Cộng đồng] [💾 Lưu XML] [📂 Mở XML]   │
├──────────────────────────────────────────────┤
│                               [🗺️ layer]    │
│            Bản đồ (flex:1)     (top-right)  │
│                                  [compass]   │
│  [📏]                            (bot-right) │
└──────────────────────────────────────────────┘
  Sidebar drawer (fixed, trượt từ phải vào)
  Backdrop tối (click để đóng sidebar)
  Modal form (fixed overlay, z-index 5000)
  Auth modal (fixed overlay, khi chưa đăng nhập)
```

---

## Chế độ hoạt động (appMode)

| Mode | Kích hoạt | Lưu trữ | Community |
|---|---|---|---|
| `'loading'` | Khởi động, chưa có lựa chọn | — | — |
| `'guest'` | Chọn "Tiếp tục không cần đăng nhập" | `localStorage` | Xem được |
| `'user'` | Đăng nhập thành công | Firestore | Xem + chia sẻ |

- **Auth modal** hiện khi `appMode === 'loading'` (chưa từng chọn)
- `GUEST_MODE_KEY = 'map_auth_mode'` — lưu `'guest'` vào localStorage khi chọn guest
- **Guest migration**: khi đăng nhập từ guest, hỏi có muốn chuyển dữ liệu lên cloud không

---

## Tile layers bản đồ

| Tên | Nguồn |
|---|---|
| 🗺️ Bản đồ | OpenStreetMap (mặc định) |
| 🛰️ Vệ tinh | ESRI World Imagery |
| 🛰️ Vệ tinh + đường | ESRI + OSM overlay 0.45 |

- Nút chọn layer: góc trên phải bản đồ (`top: 80px; right: 10px`)
- `L.DomEvent.disableClickPropagation(#layer-control)` ngăn click kích hoạt map
- Map khởi tạo với `maxZoom: 19` (bắt buộc cho markercluster)

---

## Tính năng

### 1. Bản đồ & Markers

- **Click** bản đồ → mở modal thêm địa điểm
- **Kéo marker** → cập nhật tọa độ lên Firestore
- **Chuột phải / long-press** → popup Street View
- **Marker clustering**: các marker gần nhau tự động gộp thành cluster; tách ra khi zoom ≥ 17
  - `clusterGroup` — markers cá nhân
  - `communityClusterGroup` — markers cộng đồng
  - Hai group độc lập, không cluster lẫn nhau

### 2. Địa điểm cộng đồng (public_locations)

- Tất cả user kể cả guest đều thấy địa điểm được chia sẻ trực tiếp trên bản đồ
- **Không có sidebar tab** — community markers luôn load tự động theo viewport
- **Toggle**: nút **🌍 Cộng đồng** trên toolbar — ẩn/hiện toàn bộ community markers
  - CSS off-state: `.search-bar button.gray.off { background: #bdbdbd; }`
  - Ẩn: xóa khỏi `communityClusterGroup` nhưng giữ trong `communityMarkers` object
  - Hiện lại: re-add từ `communityMarkers`, không cần fetch lại Firestore
- **Viewport lazy-load**: `loadCommunityByViewport()` dùng `onSnapshot` + padding 15%
- **Chia sẻ**: checkbox "Chia sẻ công khai" trong modal → ghi vào `public_locations/{id}` với `ownerUid`
- Community marker dùng `createCommunityIcon()` — khác màu/style với personal marker

### 3. Tìm kiếm (ô thông minh)

**Tìm theo tên địa điểm:**
- Gợi ý tự động sau 400ms khi gõ ≥ 3 ký tự (Nominatim API)
- Kết quả tiếng Việt (`accept-language=vi`)
- Không tự thêm marker khi tìm

**Tìm theo tọa độ:**
- Nhập `21.0285, 105.8542` hoặc `21.0285 105.8542`
- Regex: `/^\s*(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)\s*$/`
- Nếu khớp → `map.setView([lat, lng], 15)` ngay, không gọi Nominatim

### 4. Sidebar danh sách (Drawer)

- Nút header "📋 Địa điểm đã lưu N" → trượt drawer từ phải vào
- Không còn section "Thêm địa điểm" (đã bỏ)
- Mỗi item: màu pin, tên, mô tả, giá dự kiến, số điện thoại (link gọi), tọa độ
- Click item → `flyTo()` → `clusterGroup.zoomToShowLayer(m, () => m.openPopup())`
- Hover → nút Sửa / Xóa
- Kéo thả sắp xếp → cập nhật `sortOrder` lên Firestore

### 5. Nhóm địa điểm trong sidebar

Dropdown "☰ Danh sách" nhóm theo: `area`, `direction`, `usage`, `structure`, `color`, `price`

- Header nhóm click được để thu gọn / mở ra
- Khu vực: Nominatim reverse geocode tự động

### 6. Modal thêm/sửa địa điểm

**Trường cơ bản:** Tên*, Mô tả, Ghi chú, Hình ảnh (multi), Link web, Số điện thoại, Màu marker, Tọa độ (readonly)

**Thông tin đất:** Hướng, Diện tích, Chiều ngang, Chiều dài, Giá trị dự kiến

**Tài sản gắn liền:** DT xây dựng, DT sàn, Kết cấu, Công năng

**Chia sẻ:** Checkbox "Chia sẻ công khai" → ghi thêm vào `public_locations`

### 7. Label tên trên marker

`L.divIcon` với `<span>` absolute — nền trắng, bo `10px`, shadow, font 11px bold, max 150px.

### 8. Đa ảnh (Multi-image)

- Nhiều slot ảnh, mỗi slot: ô URL + nút 📁 (upload) + nút ✕ + thumbnail + nút 🔍 OCR
- Upload: Canvas resize (≤1200px) + nén JPEG 0.75 → `telegra.ph/upload` → fallback base64
- `images: ["url1", "url2", ...]` trong Firestore; `image: images[0]` giữ tương thích ngược
- Popup: 1 ảnh = full-width; nhiều ảnh = ảnh chính + thumbnail gallery

### 9. OCR — Trích xuất thông tin từ ảnh

- Tesseract.js v5, lazy-load, worker singleton
- Ngôn ngữ: `vie` + `eng`
- Chỉ điền vào ô trống, không ghi đè dữ liệu có sẵn

### 10. Popup thông tin marker

- Tên, mô tả (60 ký tự + nút ···), ghi chú, link, gallery ảnh
- Số điện thoại + nút **"Gọi"** (`href="tel:"`)
- Nút Sửa, Xóa, 🚶 Street View
- Layout 2 cột: `row2(l1,v1,u1, l2,v2,u2)`
- Tọa độ: 5 chữ số thập phân

### 11. Hoa hướng

Leaflet custom control `bottomright`, SVG 96×96px, `pointer-events:none`. Hướng Bắc màu đỏ `#e53935`.

### 12. Đo khoảng cách / diện tích

- Nút 📏 `bottomleft` — bật/tắt chế độ đo
- 2 điểm → khoảng cách (Haversine); ≥3 điểm → đa giác + diện tích (ha/m²)
- Nhãn khoảng cách dùng `L.tooltip` — nền xanh lá bo tròn

---

## Lưu trữ dữ liệu (Firebase Firestore)

**Collections:**
- `users/{uid}/locations/{id}` — địa điểm cá nhân (chỉ owner đọc/ghi)
- `public_locations/{id}` — địa điểm cộng đồng (tất cả đọc được, owner ghi)

**Viewport lazy-load:**
- Chỉ load markers trong viewport hiện tại (`map.getBounds().pad(0.15)`)
- `onSnapshot()` lắng nghe real-time thay đổi
- `moveend` → debounce 800ms → reload viewport

**Security Rules (Firebase Console):**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/locations/{id} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /public_locations/{locId} {
      allow read: if true;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.ownerUid;
      allow update, delete: if request.auth != null && request.auth.uid == resource.data.ownerUid;
    }
  }
}
```

**Giới hạn free tier (vĩnh viễn):** 50K đọc / 20K ghi / 20K xóa / ngày.

---

## Cấu trúc object địa điểm

```javascript
{
  id,          // Date.now() — Firestore doc ID (string)
  lat, lng,
  name,        // *bắt buộc
  desc,
  note,
  images,      // ["url1", "url2", ...]
  image,       // images[0] — tương thích ngược
  link,
  phone,
  color,       // hex màu marker
  area,        // Nominatim reverse geocode
  direction,
  acreage,     // m²
  width,       // m
  length,      // m
  price,
  buildArea,   // m²
  floorArea,   // m²
  structure,
  usage,
  sortOrder,
  createdAt,
  isPublic,    // boolean — có trong public_locations không
  ownerUid,    // uid của owner (chỉ có trong public_locations)
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

Personal marker: pin SVG 28×36px + label tên. Community marker: `createCommunityIcon()` — style khác biệt.

---

## Biến trạng thái JS

| Biến | Kiểu | Mô tả |
|---|---|---|
| `appMode` | `string` | `'loading'` \| `'guest'` \| `'user'` |
| `currentUser` | `FirebaseUser\|null` | User đang đăng nhập |
| `db` | `Firestore` | `firebase.firestore()` |
| `locations` | `Array` | Địa điểm cá nhân (viewport hiện tại) |
| `leafletMarkers` | `Object` | `id → L.marker` (personal) |
| `clusterGroup` | `L.markerClusterGroup` | Cluster group cá nhân |
| `communityClusterGroup` | `L.markerClusterGroup` | Cluster group cộng đồng |
| `communityLocations` | `Array` | Địa điểm cộng đồng (viewport hiện tại) |
| `communityMarkers` | `Object` | `id → L.marker` (community) |
| `communityUnsub` | `Function\|null` | Unsubscribe Firestore listener community |
| `communityVpTimer` | `number` | Timer debounce reload community |
| `communityVisible` | `boolean` | Toggle hiện/ẩn community markers |
| `viewportUnsub` | `Function\|null` | Unsubscribe Firestore listener cá nhân |
| `vpTimer` | `number` | Timer debounce reload viewport cá nhân |
| `pendingLatLng` | `Object\|null` | Tọa độ click đang chờ lưu |
| `pendingTextData` | `Object\|null` | Data parsed từ text, chờ click map |
| `editingId` | `number\|null` | ID đang chỉnh sửa |
| `selectedColor` | `string` | Màu hex đang chọn trong modal |
| `sidebarVisible` | `boolean` | Trạng thái drawer |
| `currentBaseLayer` | `string` | `'street'` \| `'satellite'` \| `'hybrid'` |
| `groupByField` | `string` | Trường đang nhóm (`''` = không nhóm) |
| `collapsedGroups` | `Set` | Nhóm đang thu gọn |
| `savedFileHandle` | `FileSystemFileHandle\|null` | Handle file XML |
| `myLocationMarker` | `L.marker\|null` | Marker GPS |
| `measureMode` | `boolean` | Chế độ đo đang bật |
| `measurePoints` | `Array` | Điểm click trong lượt đo |
| `measureGroup` | `L.layerGroup` | Layer group đo tạm thời |
| `ocrWorker` | `Tesseract.Worker\|null` | Worker OCR singleton |
| `imgSlotCounter` | `number` | Counter DOM slot ảnh |

---

## Các hàm JS chính

| Hàm | Mục đích |
|---|---|
| `makeClusterGroup()` | Tạo `L.markerClusterGroup` hoặc fallback `L.layerGroup` |
| `startFirestoreSync()` | Khởi động sync Firestore (user mode) |
| `activateGuestMode()` | Kích hoạt guest mode |
| `loadByViewport()` | Load markers cá nhân theo viewport (onSnapshot) |
| `applyDocChange(change)` | Xử lý Firestore doc change (added/modified/removed) |
| `loadCommunityByViewport()` | Load community markers theo viewport |
| `addCommunityMarker(loc)` | Thêm marker cộng đồng vào cluster group |
| `clearCommunityMarkers()` | Xóa toàn bộ community markers |
| `toggleCommunityMarkers()` | Ẩn/hiện community markers + cập nhật nút |
| `updateModeBadge()` | Cập nhật badge mode trên header |
| `openAuthModal()` | Mở modal đăng nhập/đăng ký/thông tin |
| `closeAuthModal()` | Đóng modal auth |
| `switchAuthTab(tab)` | Chuyển tab login/register |
| `authSubmit()` | Đăng nhập hoặc đăng ký |
| `authLogout()` | Đăng xuất |
| `continueAsGuest()` | Chọn chế độ khách |
| `offerGuestMigration()` | Hỏi chuyển dữ liệu guest lên cloud |
| `renderMarkers()` | Xóa + vẽ lại markers cá nhân |
| `addMarker(loc)` | Thêm marker cá nhân vào clusterGroup |
| `renderSidebar()` | Render danh sách / nhóm trong sidebar |
| `flyTo(id)` | Bay đến marker, `zoomToShowLayer` rồi openPopup |
| `openModal(title, data)` | Mở modal thêm/sửa |
| `closeModal()` | Đóng modal, reset state |
| `saveLocation()` | Submit form → ghi Firestore |
| `editLocation(id)` | Mở modal sửa |
| `deleteLocation(id)` | Xóa Firestore sau confirm |
| `createIcon(color, name)` | divIcon pin SVG + label tên (personal) |
| `createCommunityIcon(color, name)` | divIcon community marker |
| `makePopupHtml(loc, isCommunity)` | HTML popup (gallery, truncate, 2 cột, XSS escape) |
| `toggleLayerPicker()` | Mở/đóng popup chọn layer |
| `setBaseLayer(mode)` | Đổi tile layer |
| `toggleSidebar()` | Toggle drawer |
| `showHint(text)` | Hint text trên bản đồ 3 giây |
| `searchLocation()` | Tìm kiếm thông minh |
| `fetchSuggestions(query)` | Nominatim gợi ý |
| `selectResult(item)` | Chọn kết quả Nominatim |
| `goToMyLocation()` | GPS → icon pulse + flyTo |
| `handleMeasureClick(latlng)` | Đo khoảng cách/diện tích |
| `fetchArea(id, lat, lng)` | Nominatim reverse geocode → Firestore |
| `saveXML()` | Xuất XML |
| `importXML(event)` | Import XML → Firestore |
| `esc(str)` | Escape HTML (XSS) |
| `xmlEsc(str)` | Escape XML |
| `ensureOCR()` | Lazy-load Tesseract |
| `parseRealEstateText(text)` | Parse text BĐS |
| `parsePrice(t)` | Parse giá (tỷ/triệu/ty) |

---

## PWA & Service Worker

- **Cache key hiện tại:** `bandog-v9`
- **CORE files pre-cached:** `index.html`, `manifest.json`, toàn bộ `lib/` (local — không phụ thuộc CDN)
- **Pre-cache dùng `Promise.allSettled`** — install không fail dù có resource lỗi
- **Chiến lược:**
  - Local files + `lib/`: Cache first
  - External (tiles, Nominatim, Firebase, Firestore, gstatic): Network first, cache fallback
- **Update SW:** tăng `CACHE = 'bandog-vN'` trong `sw.js` → push → user F12 → Application → Service Workers → Update

---

## XML export/import

- `<image>` — ảnh đầu tiên (tương thích ngược)
- `<images>` — nhiều URL cách nhau `|||`
- Import: ưu tiên `<images>`, fallback `<image>`

---

## Quy trình deploy

```
Sửa Mobile/index.html (và/hoặc sw.js nếu cần bust cache)
  → git add . && git commit -m "..." && git push
  → chờ GitHub Pages build (~1 phút)
  → F12 → Application → Service Workers → Update (hoặc chờ tự update)
```

---

## Lưu ý kỹ thuật

- **XSS:** mọi dữ liệu qua `esc()` (HTML) hoặc `xmlEsc()` (XML)
- **maxZoom bắt buộc:** `L.map({maxZoom: 19})` — markercluster gọi `map.getMaxZoom()` nội bộ; thiếu → lỗi "Map has no maxZoom specified"
- **Self-hosted libs:** `lib/` trong repo → không bị ảnh hưởng khi CDN (unpkg/cdnjs) down
- **Cluster + popup:** dùng `clusterGroup.zoomToShowLayer(m, cb)` thay vì `m.openPopup()` trực tiếp — cluster cần mở ra trước
- **Community visibility toggle:** markers được giữ trong `communityMarkers` object khi ẩn → re-add không cần re-fetch Firestore
- **Firestore offline:** SDK tự cache local, sync lại khi có mạng
- **telegra.ph:** ảnh công khai, vĩnh viễn
- **iOS PWA:** không có push notification, không background sync
- **Nominatim rate limit:** 1 req/s — debounce 400ms (search) / 1100ms (geocode)
