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
- **SW cache hiện tại:** `bandog-v30`
- **Cloudflare Worker:** `https://bdsmap-share.phuongdai-ho.workers.dev/?id=ID` — phục vụ OG tags động cho Facebook/Zalo/X

---

## Cấu trúc thư mục

```
Mobile/
├── index.html              ← App chính (toàn bộ HTML/CSS/JS)
├── export.html             ← Tool xuất toàn bộ Firestore → XML (standalone, không cần server)
├── manifest.json           ← Khai báo PWA (tên, màu, icons)
├── sw.js                   ← Service Worker (offline cache, hiện v30)
├── share-worker.js         ← Cloudflare Worker — OG tags động cho Facebook/Zalo/X (deploy lên Cloudflare riêng)
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
    └── icon-512.png        ← 512×512, PWA manifest + OG image fallback
```

---

## Layout giao diện

```
┌──────────────────────────────────────────────────────┐
│  Header (xanh #1a73e8)                               │
│  [● Khách]  [🏠 Xem nhanh]  [📋 Của tôi]           │
├──────────────────────────────────────────────────────┤
│  Search bar                                           │
│  [ô tìm kiếm] [Tìm] [💾 Lưu XML] [📂 Mở XML]      │
├──────────────────────────────────────────────────────┤
│                                                       │
│            Bản đồ (flex:1)                            │
│                                      [compass]        │
│                                      (bot-right)      │
│  [📏 đo]   [🚩 GPS]                                  │
│  (bot-left) [🌍 CĐ]                                  │
│             [🗺️ layer]                               │
│             (bot-left, flex column)                   │
└──────────────────────────────────────────────────────┘
  Sidebar drawer (fixed, trượt từ phải vào)
    ├── Header "Danh sách địa điểm" + dropdown nhóm
    ├── Tab bar: [Cá nhân N] [Cộng đồng N]
    └── Danh sách địa điểm theo tab đang chọn
  Backdrop tối (click để đóng sidebar)
  Modal form (fixed overlay, z-index 5000)
  Auth modal (fixed overlay, khi chưa đăng nhập)
  Quick View overlay (fixed, z-index 8000, toàn màn hình)
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

- Nút chọn layer nằm trong `#layer-control` (flex column, `bottom: 56px; left: 10px`)
- `L.DomEvent.disableClickPropagation(#layer-control)` ngăn click kích hoạt map
- Map khởi tạo với `maxZoom: 19` (bắt buộc cho markercluster)

---

## Tính năng

### 1. Bản đồ & Markers

- **Click** bản đồ → mở modal thêm địa điểm
- **Kéo marker** → cập nhật tọa độ lên Firestore
- **Chuột phải / long-press** → popup Street View
- **Marker clustering**: tất cả markers (cá nhân + cộng đồng) gộp vào **một cluster group duy nhất**
  - `clusterGroup` — dùng cho cả personal và community (không phân biệt của ai)
  - `communityClusterGroup` — alias của `clusterGroup` (dùng chung code cũ)
  - `maxClusterRadius: 60px`; **tách ra khi zoom ≥ 14** (`disableClusteringAtZoom: 14`)
  - Cluster icon tùy chỉnh: nền `#1a73e8`, chữ trắng, bo tròn, kích thước 34/40/46px theo số lượng
  - `clearCommunityMarkers()` dùng `removeLayer` từng marker — **không** dùng `clearLayers()` (sẽ xóa cả personal markers)

### 2. Load địa điểm cá nhân (User mode)

- **Load toàn bộ** — `loadByViewport()` subscribe `users/{uid}/locations` **không filter theo viewport**
- Tất cả markers của user đều hiển thị trên bản đồ ngay khi đăng nhập
- `onSnapshot()` lắng nghe real-time thay đổi, xử lý qua `applyDocChange(change)`
- **Không reload khi di chuyển map** — vì đã có toàn bộ data; chỉ community reload theo viewport

### 3. Địa điểm cộng đồng (public_locations)

- Tất cả user kể cả guest đều thấy địa điểm được chia sẻ trực tiếp trên bản đồ
- **Toggle**: nút **🌍** trong `#layer-control` — ẩn/hiện toàn bộ community markers
  - Active state: `.measure-btn.active { background: #1a73e8; color: white; }` (xanh = đang hiện)
  - Inactive: nền trắng (ẩn markers)
  - Ẩn: xóa khỏi `clusterGroup` nhưng giữ trong `communityMarkers` object
  - Hiện lại: re-add từ `communityMarkers`, không cần fetch lại Firestore
- **Viewport lazy-load**: `loadCommunityByViewport(reset = false)` dùng `onSnapshot` + padding 15%
  - **`reset = false`** (mặc định, khi di chuyển map): **không** xóa markers đang có — chỉ thêm markers mới vào. Firestore `removed` event = ra ngoài viewport, không phải xóa thật → bỏ qua hoàn toàn
  - **`reset = true`** (khi đăng nhập / đổi chế độ): xóa toàn bộ community markers + reset `communityLocations = []` trước khi load
  - Reload khi di chuyển map: `moveend` → debounce 800ms → `loadCommunityByViewport()` (không reset)
- **Tab Cộng đồng & Quick View**: chỉ hiển thị địa điểm **không thuộc user hiện tại** (`loc.ownerUid !== currentUser?.uid`)
- **Chia sẻ**: checkbox "Chia sẻ công khai" trong modal → ghi vào `public_locations/{id}` với `ownerUid`
- Community marker dùng `createCommunityIcon()` — style khác biệt (opacity 0.75, badge 🌍)

### 4. Auth (đăng nhập / đăng ký / quên mật khẩu)

- **Đăng nhập / Đăng ký**: 2 tab trong auth modal, dùng Firebase `signInWithEmailAndPassword` / `createUserWithEmailAndPassword`
- **Quên mật khẩu**: link "Quên mật khẩu?" bên phải dưới ô password, chỉ hiện ở tab Đăng nhập
  - Hàm `forgotPassword()`: gọi `auth.sendPasswordResetEmail(email)`
  - Thành công → hiện thông báo xanh lá (`.auth-success`) thay vì đỏ lỗi
  - Lỗi: `auth/user-not-found`, `auth/invalid-email` → thông báo tiếng Việt
- **Đăng xuất**: mở auth modal khi đã đăng nhập → nút "Đăng xuất"
- **Guest mode**: nút "👤 Tiếp tục không cần đăng nhập" → `localStorage`

### 5. Tìm kiếm (ô thông minh)

**Tìm theo tên địa điểm:**
- Gợi ý tự động sau 400ms khi gõ ≥ 3 ký tự (Nominatim API)
- Kết quả tiếng Việt (`accept-language=vi`)
- Không tự thêm marker khi tìm

**Tìm theo tọa độ:**
- Nhập `21.0285, 105.8542` hoặc `21.0285 105.8542`
- Regex: `/^\s*(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)\s*$/`
- Nếu khớp → `map.setView([lat, lng], 15)` ngay, không gọi Nominatim

### 6. Vị trí GPS (Live tracking) & Nút 🚩

- Nút **🚩** nằm trong `#layer-control` (phía trên nút 🌍 và 🗺️ layer), style `.measure-btn`
- **`initLocationWatch()`**: gọi khi khởi động app (`startFirestoreSync` và `activateGuestMode`)
  - Tự động center bản đồ về vị trí GPS ngay khi có tín hiệu đầu tiên
  - Không mở popup tự động
- **`goToMyLocation()`**: nút 🚩 trên `#layer-control`
  - Nếu watch đang chạy → center map về vị trí hiện tại + mở popup
  - Nếu chưa → gọi `startLocationWatch(true, true)`
- **`startLocationWatch(centerMap, openPopupOnFirst)`**:
  - Dùng `navigator.geolocation.watchPosition` — cập nhật liên tục khi user di chuyển
  - Icon pulse (`.my-location-icon`) di chuyển theo GPS realtime
  - Chỉ tạo một watch duy nhất (`myLocationWatchId`); các lần gọi sau chỉ re-center

### 7. Map Controls (`#layer-control`)

Tất cả nút điều khiển nằm trong `#layer-control` (flex column, `bottom: 56px; left: 10px; gap: 6px`):

```html
<div id="layer-control">
  <button id="btn-my-location" class="measure-btn" onclick="goToMyLocation()">🚩</button>
  <button id="btn-toggle-community" class="measure-btn active" onclick="toggleCommunityMarkers()">🌍</button>
  <button id="btn-layer-toggle" onclick="toggleLayerPicker()">🗺️ SVG</button>
  <div class="layer-picker" id="layer-picker">...</div>
</div>
```

CSS `.measure-btn`: `36×36px`, nền trắng, `border-radius: 4px`, `box-shadow: 0 1px 5px rgba(0,0,0,0.35)`
CSS `.measure-btn.active`: `background: #1a73e8; color: white` (trạng thái bật/xanh)

### 8. Header toolbar

Các nút trên header (từ trái sang phải):
- **`[● Khách]` / `[● Tên user]`** — badge mode, click mở auth modal
- **`[🏠 Xem nhanh]`** — mở Quick View BĐS đang bán gần vị trí GPS
- **`[📋 Của tôi]`** — toggle sidebar drawer (không có badge số lượng)

### 9. Sidebar — Tab Cá nhân / Cộng đồng

Sidebar có 2 tab bên dưới header "Danh sách địa điểm":
- **Tab Cá nhân `N`**: danh sách `locations` của user đang đăng nhập + badge số lượng
- **Tab Cộng đồng `N`**: `communityLocations` trong viewport, **loại trừ địa điểm của chính user** + badge số lượng

**Badge số lượng trên tab:**
```html
<button class="sidebar-tab active" id="tab-personal" onclick="switchSidebarTab('personal')">
  Cá nhân<span class="tab-count" id="count-personal">0</span>
</button>
<button class="sidebar-tab" id="tab-community" onclick="switchSidebarTab('community')">
  Cộng đồng<span class="tab-count" id="count-community">0</span>
</button>
```
CSS `.tab-count`: nền `#bdbdbd` (inactive), `#1a73e8` (active tab)

**`switchSidebarTab(tab)`**: cập nhật `sidebarTab`, toggle `.active`, gọi `renderSidebar()`

**Filter group-by hoạt động trên cả 2 tab**:
- Dropdown "☰ Danh sách" nhóm theo: `area`, `direction`, `usage`, `structure`, `color`, `price`
- Tab Cá nhân dùng `createLocItem()` (có drag-drop)
- Tab Cộng đồng dùng `createCommunityLocItem()` (không drag-drop; Sửa/Xóa chỉ hiện nếu `ownerUid === currentUser.uid`)

**`flyToCommunity(id)`**: bay đến community marker, mở popup sau 850ms.

### 10. Nhóm địa điểm trong sidebar

Dropdown "☰ Danh sách" nhóm theo: `area`, `direction`, `usage`, `structure`, `color`, `price`

- Header nhóm click được để thu gọn / mở ra (dùng `collapsedGroups` Set)
- Khu vực: Nominatim reverse geocode tự động (`fetchArea`)
- Cả 2 tab đều hỗ trợ nhóm — logic `getKey/groups/order` giống nhau, chỉ khác hàm tạo item

### 11. Modal thêm/sửa địa điểm

**Trường cơ bản:** Tên*, Mô tả, Ghi chú, Hình ảnh (multi), Link web, Số điện thoại, Màu marker, Tọa độ (readonly)

**Thông tin đất:** Hướng, Diện tích, Chiều ngang, Chiều dài, Giá trị dự kiến

**Pháp lý & Nội thất:** Pháp lý (`Sổ đỏ/Sổ hồng`, `Sổ hộ`, `Giấy tờ viết tay`, `Có đóng thuế phường`), Nội thất

**Tài sản gắn liền:** DT xây dựng, DT sàn, Kết cấu, Công năng

**Tình trạng BĐS:** Dropdown `Đang bán` / `Đã bán` (mặc định `Đang bán` khi thêm mới)

**Ngày cập nhật:** Date picker, mặc định hôm nay khi thêm mới; giữ nguyên khi sửa

**Chia sẻ:** Checkbox "Chia sẻ công khai" → ghi thêm vào `public_locations`

**Mobile safe area:** `padding` của `.modal-overlay` dùng `calc(16px + env(safe-area-inset-top/bottom))` — tránh bị notch/home indicator che

### 12. Label tên trên marker

`L.divIcon` với `<span>` absolute — nền trắng, bo `10px`, shadow, font 11px bold, max 150px.

### 13. Đa ảnh (Multi-image)

- Nhiều slot ảnh, mỗi slot: ô URL + nút 📁 (upload) + nút ✕ + thumbnail + nút 🔍 OCR
- Upload: Canvas resize (≤1200px) + nén JPEG 0.75 → `telegra.ph/upload` → fallback base64
- `images: ["url1", "url2", ...]` trong Firestore; `image: images[0]` giữ tương thích ngược
- Popup: 1 ảnh = full-width; nhiều ảnh = ảnh chính + thumbnail gallery

### 14. OCR — Trích xuất thông tin từ ảnh

- Tesseract.js v5, lazy-load, worker singleton
- Ngôn ngữ: `vie` + `eng`
- Chỉ điền vào ô trống, không ghi đè dữ liệu có sẵn

### 15. Popup thông tin marker

- Tên + badge `Đang bán` (xanh `#43a047`) / `Đã bán` (đỏ `#d93025`)
- Mô tả (60 ký tự + nút ···), ghi chú, link, gallery ảnh
- Số điện thoại + nút **"Gọi"** (`href="tel:"`)
- Ngày cập nhật (format `dd/mm/yyyy`)
- **"👁 Đã xem: N lần"** — hiện khi `loc.views > 0`
- Nút Sửa, Xóa (chỉ owner), **🚶 Street View**, **↗️ Chia sẻ** (tất cả marker)
- Layout 2 cột: `row2(l1,v1,u1, l2,v2,u2)`
- Tọa độ: 5 chữ số thập phân

### 16. Hoa hướng (Compass)

Leaflet custom control `bottomright`, SVG 96×96px, `pointer-events:none`. Hướng Bắc màu đỏ `#e53935`.

### 17. Đo khoảng cách / diện tích

- Nút 📏 `bottomleft` — bật/tắt chế độ đo
- 2 điểm → khoảng cách (Haversine); ≥3 điểm → đa giác + diện tích (ha/m²)
- Nhãn khoảng cách dùng `L.tooltip` — nền xanh lá bo tròn

### 18. Views (Lượt xem địa điểm)

Mỗi lần popup mở (`popupopen` Leaflet event) → tăng `views` thêm 1.

**Hiển thị:**
- Popup marker: `👁 Đã xem: N lần` (dòng nhỏ, màu `#aaa`, chỉ hiện khi `views > 0`)
- Sidebar item: `👁 Đã xem: N lần` (class `.loc-views`, màu `#bbb`)
- Quick View card: `👁 Đã xem: N lần` (dòng nhỏ màu `#bbb`)

**Loại trừ chủ sở hữu:**
- Personal locations (`incrementViews`): hàm no-op — user luôn là chủ, không đếm
- Community locations (`incrementCommunityViews`): kiểm tra `communityLocations[locIdx].ownerUid === currentUser?.uid` → bỏ qua nếu là chủ; guest (không đăng nhập) vẫn tính bình thường

**Debounce chống đếm 2 lần:**
- `recentlyViewed` Set với TTL 5 giây — ngăn đếm kép khi user xem Quick View rồi nhấn "Xem trên bản đồ" mở thêm popup trong vòng 5s
- Key: `'c_' + id` cho community locations

**Lưu trữ:**
- Personal: field `views` trong `users/{uid}/locations/{id}` (không dùng trong thực tế vì no-op)
- Community: `FieldValue.increment(1)` lên `public_locations/{id}` + cập nhật local `communityLocations[idx].views` và `quickViewItems[idx].views` đồng bộ trước `await`

**Firebase Security Rules** cần thêm để cho phép mọi authenticated user increment `views` trên `public_locations`:
```javascript
allow update: if request.auth != null && request.auth.uid == resource.data.ownerUid
  || (request.auth != null
      && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['views']));
```

### 19. Quick View "🏠 Xem nhanh"

Nút **"🏠 Xem nhanh"** trên header.

**Mục đích:** xem nhanh các BĐS cộng đồng `Đang bán` trong bán kính **5 km** quanh vị trí GPS của user, **không thuộc chính user**.

**Khi bấm nút:**
1. Lấy vị trí: ưu tiên `myLocationMarker.getLatLng()` (không hỏi lại quyền GPS), nếu chưa có thì gọi `navigator.geolocation.getCurrentPosition()`
2. Lọc `communityLocations`: `ownerUid !== currentUser?.uid` + `status === 'Đang bán'` (hoặc chưa có status) + `_dist <= 5 km`
3. Sắp xếp theo khoảng cách gần nhất trước
4. Mở overlay toàn màn hình (`z-index: 8000`)

**Nội dung card:**
- Carousel ảnh chính + thumbnail row
- Tên + badge "Đang bán" + khoảng cách + ngày cập nhật
- Giá, khu vực
- Chi tiết đất (diện tích, ngang, dài, hướng, pháp lý, lộ giới)
- Kết cấu, công năng, nội thất, DT xây dựng, DT sàn
- Mô tả, ghi chú
- `👁 Đã xem: N lần` (views)
- Số điện thoại + nút "Gọi ngay"
- Link xem thêm + owner badge
- Tọa độ (`🌐 lat, lng` — 5 chữ số thập phân)
- Nút **↗️ Chia sẻ** — gọi `shareLocation(id, name)`

**Điều hướng:**
- Nút **◀ Trước / Sau ▶** (disabled khi ở đầu/cuối)
- Nút **📍 Trên bản đồ** → đóng overlay, `flyTo` marker, mở popup sau 900ms
- **Swipe trái → Sau / Swipe phải → Trước** (mobile, threshold 55px)
- Nút **✕** hoặc nút trên bản đồ → đóng

**Safe area mobile:** header dùng `padding-top: calc(10px + env(safe-area-inset-top))`, footer dùng `padding-bottom: calc(10px + env(safe-area-inset-bottom))`.

### 20. Chia sẻ BĐS lên mạng xã hội (Share)

**Kiến trúc Tầng 2 — Cloudflare Worker + Web Share API + Deep link:**

```
User nhấn ↗️ Chia sẻ
  → shareLocation(id, name)
  → URL: https://bdsmap-share.phuongdai-ho.workers.dev/?id=ID
  → navigator.share() (mobile) hoặc clipboard (desktop)

Facebook/Zalo bot → GET URL trên
  → Worker: fetch Firestore public_locations/{id}
  → Trả về HTML tĩnh với OG tags (title, desc, image)
  → Bot đọc OG → hiện rich preview
  → User thật: JS redirect → APP_URL?share=ID

App tải với ?share=ID
  → pendingShareId = ID
  → Sau auth (user hoặc guest): handleShareLink(ID)
  → Fetch Firestore, flyTo marker, mở Quick View
```

**Config constants (trong `index.html`):**
```javascript
const SHARE_WORKER_URL = 'https://bdsmap-share.phuongdai-ho.workers.dev';
const FIREBASE_API_KEY = 'AIzaSyBuuxnR8w8Sd2VSuMfU8Sx7S3aoYLWneD8';
const FIREBASE_PROJECT = 'bdsmap-3b584';
```

**`share-worker.js` — Cloudflare Worker:**
- Deploy riêng tại Cloudflare Workers dashboard (không phải GitHub Pages)
- Fetch `public_locations/{id}` từ Firestore REST API (timeout 3s)
- Build HTML với đầy đủ OG tags: `og:title`, `og:description`, `og:image`, `og:image:width/height/type`, `og:locale`
- Twitter Card: `summary` (icon fallback) hoặc `summary_large_image` (ảnh thật)
- **Không dùng `<meta http-equiv="refresh">`** — Facebook bot sẽ follow redirect về GitHub Pages → mất OG tags
- JS-only redirect (`window.location.replace`) — bot không chạy JS, ở lại đọc OG tags
- Nếu Firestore fail → trả HTML tĩnh với default image (không redirect 302)
- **Lọc ảnh base64**: chỉ dùng URL `http/https`; `data:` URLs không hợp lệ cho Facebook → fallback `icon-512.png`
- `og:image` fallback: `https://phuongdaiho.github.io/BDSMap/icons/icon-512.png` (512×512 PNG)

**Nút Chia sẻ:**
- Popup marker: `↗️ Chia sẻ` — hiện cho **tất cả marker** (không phân biệt community/personal)
- Quick View card: nút `↗️ Chia sẻ` cuối card (`.qv-share-btn`)

**Lưu ý:**
- Share link chỉ hoạt động đầy đủ cho community locations (`public_locations`) — personal locations không có trong Firestore công khai nên Worker sẽ báo "Không tìm thấy BĐS"
- Sau khi update Worker, cần "Thu thập lại" trong Facebook Sharing Debugger để xóa cache

### 22. Export toàn bộ dữ liệu (export.html)

File `export.html` — standalone tool, mở trực tiếp trên browser:
- Đăng nhập email/password (Firebase Auth)
- Gọi `.get()` trên `users/{uid}/locations` — **không filter viewport**, lấy toàn bộ records
- Generate XML cùng format với app → tự động tải xuống `data.xml`
- **Lưu ý:** tài khoản đăng nhập bằng Google không có password → cần đặt password trong Firebase Console trước

---

## Lưu trữ dữ liệu (Firebase Firestore)

**Collections:**
- `users/{uid}/locations/{id}` — địa điểm cá nhân (chỉ owner đọc/ghi)
- `public_locations/{id}` — địa điểm cộng đồng (tất cả đọc được, owner ghi)

**Chiến lược load:**

| Collection | Chiến lược | Reload khi di chuyển map |
|---|---|---|
| `users/{uid}/locations` | Load **toàn bộ**, một lần khi đăng nhập | Không |
| `public_locations` | Viewport lazy-load (`.pad(0.15)`) | Có — debounce 800ms, không reset markers |

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
      allow update: if request.auth != null && (
        request.auth.uid == resource.data.ownerUid
        || request.resource.data.diff(resource.data).affectedKeys().hasOnly(['views'])
      );
      allow delete: if request.auth != null && request.auth.uid == resource.data.ownerUid;
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
  roadWidth,
  legal,
  interior,
  status,      // "Đang bán" (mặc định) | "Đã bán"
  updatedDate, // "YYYY-MM-DD" — ngày cập nhật mới nhất, mặc định hôm nay
  sortOrder,
  createdAt,
  isPublic,    // boolean — có trong public_locations không
  ownerUid,    // uid của owner (chỉ có trong public_locations)
  ownerEmail,  // email của owner (chỉ có trong public_locations)
  views,       // number — lượt xem; community only (personal luôn = 0)
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

Personal marker: pin SVG 28×36px + label tên. Community marker: `createCommunityIcon()` — opacity 0.75, badge 🌍 góc trên phải.

---

## Biến trạng thái JS

| Biến | Kiểu | Mô tả |
|---|---|---|
| `appMode` | `string` | `'loading'` \| `'guest'` \| `'user'` |
| `currentUser` | `FirebaseUser\|null` | User đang đăng nhập |
| `db` | `Firestore` | `firebase.firestore()` |
| `locations` | `Array` | **Toàn bộ** địa điểm cá nhân (không giới hạn viewport) |
| `leafletMarkers` | `Object` | `id → L.marker` (personal) |
| `clusterGroup` | `L.markerClusterGroup` | Cluster group duy nhất (personal + community) |
| `communityClusterGroup` | alias | `= clusterGroup` — giữ để không đổi code cũ |
| `communityLocations` | `Array` | Địa điểm cộng đồng tích lũy (viewport hiện tại + vùng đã qua) |
| `communityMarkers` | `Object` | `id → L.marker` (community) |
| `communityUnsub` | `Function\|null` | Unsubscribe Firestore listener community |
| `communityVpTimer` | `number` | Timer debounce reload community khi map di chuyển |
| `communityVisible` | `boolean` | Toggle hiện/ẩn community markers |
| `viewportUnsub` | `Function\|null` | Unsubscribe Firestore listener cá nhân |
| `recentlyViewed` | `Set` | Debounce views: key `'c_'+id`, TTL 5s — ngăn đếm 2 lần (quick view + popup) |
| `sidebarTab` | `string` | `'personal'` \| `'community'` — tab đang hiện trong sidebar |
| `groupByField` | `string` | Trường đang nhóm (`''` = không nhóm) |
| `collapsedGroups` | `Set` | Nhóm đang thu gọn |
| `pendingLatLng` | `Object\|null` | Tọa độ click đang chờ lưu |
| `pendingTextData` | `Object\|null` | Data parsed từ text, chờ click map |
| `editingId` | `number\|null` | ID đang chỉnh sửa |
| `selectedColor` | `string` | Màu hex đang chọn trong modal |
| `sidebarVisible` | `boolean` | Trạng thái drawer |
| `currentBaseLayer` | `string` | `'street'` \| `'satellite'` \| `'hybrid'` |
| `myLocationMarker` | `L.marker\|null` | Marker GPS vị trí người dùng |
| `myLocationWatchId` | `number\|null` | ID từ `watchPosition`; `null` = chưa khởi động |
| `savedFileHandle` | `FileSystemFileHandle\|null` | Handle file XML (File System Access API) |
| `measureMode` | `boolean` | Chế độ đo đang bật |
| `measurePoints` | `Array` | Điểm click trong lượt đo |
| `measureGroup` | `L.layerGroup` | Layer group đo tạm thời |
| `ocrWorker` | `Tesseract.Worker\|null` | Worker OCR singleton |
| `imgSlotCounter` | `number` | Counter DOM slot ảnh |
| `quickViewItems` | `Array` | BĐS đang bán đã lọc cho Quick View |
| `quickViewIdx` | `number` | Index card đang xem trong Quick View |
| `quickViewUserPos` | `Object\|null` | `{ lat, lng }` vị trí user lúc mở Quick View |
| `pendingShareId` | `string\|null` | ID lấy từ `?share=ID` trên URL — xử lý sau khi auth xong |

---

## Các hàm JS chính

| Hàm | Mục đích |
|---|---|
| `makeClusterGroup()` | Tạo `L.markerClusterGroup` (icon tùy chỉnh `#1a73e8`) hoặc fallback `L.layerGroup` |
| `startFirestoreSync()` | Khởi động sync Firestore (user mode), gọi `loadCommunityByViewport(true)` |
| `activateGuestMode()` | Kích hoạt guest mode, gọi `loadCommunityByViewport(true)` |
| `loadByViewport()` | Load **toàn bộ** locations cá nhân (không filter viewport) với `onSnapshot` |
| `applyDocChange(change)` | Xử lý Firestore doc change (added/modified/removed) |
| `loadCommunityByViewport(reset)` | Load community markers theo viewport; `reset=true` xóa sạch trước, `reset=false` chỉ thêm mới |
| `addCommunityMarker(loc)` | Thêm marker cộng đồng vào cluster group |
| `clearCommunityMarkers()` | Xóa community markers bằng `removeLayer` từng cái (không dùng `clearLayers`) |
| `toggleCommunityMarkers()` | Ẩn/hiện community markers + cập nhật `.active` trên nút 🌍 |
| `incrementViews(id)` | No-op — personal luôn là chủ sở hữu, không đếm |
| `incrementCommunityViews(id)` | Tăng `views` +1 cho community loc (debounce 5s, bỏ qua nếu viewer là owner) |
| `updateModeBadge()` | Cập nhật badge mode trên header |
| `openAuthModal()` | Mở modal đăng nhập/đăng ký/thông tin |
| `closeAuthModal()` | Đóng modal auth |
| `switchAuthTab(tab)` | Chuyển tab login/register; ẩn/hiện link "Quên mật khẩu?" |
| `forgotPassword()` | Gửi email đặt lại mật khẩu qua `auth.sendPasswordResetEmail()` |
| `authSubmit()` | Đăng nhập hoặc đăng ký |
| `authLogout()` | Đăng xuất |
| `continueAsGuest()` | Chọn chế độ khách |
| `offerGuestMigration()` | Hỏi chuyển dữ liệu guest lên cloud |
| `renderMarkers()` | Xóa + vẽ lại markers cá nhân |
| `addMarker(loc)` | Thêm marker cá nhân vào clusterGroup |
| `renderSidebar()` | Render danh sách / nhóm theo `sidebarTab`; cập nhật tab count badges |
| `switchSidebarTab(tab)` | Đổi tab sidebar (personal/community), gọi `renderSidebar()` |
| `createLocItem(loc)` | Tạo DOM item cho tab Cá nhân (có drag-drop) |
| `createCommunityLocItem(loc)` | Tạo DOM item cho tab Cộng đồng (Sửa/Xóa chỉ hiện nếu owner) |
| `flyTo(id)` | Bay đến personal marker, `zoomToShowLayer` rồi openPopup |
| `flyToCommunity(id)` | Bay đến community marker, mở popup sau 850ms |
| `openModal(title, data)` | Mở modal thêm/sửa |
| `closeModal()` | Đóng modal, reset state |
| `saveLocation()` | Submit form → ghi Firestore |
| `editLocation(id)` | Mở modal sửa |
| `deleteLocation(id)` | Xóa Firestore sau confirm |
| `createIcon(color, name)` | divIcon pin SVG + label tên (personal) |
| `createCommunityIcon(color, name)` | divIcon community marker (opacity 0.75, badge 🌍) |
| `makePopupHtml(loc, isCommunity)` | HTML popup (gallery, truncate, 2 cột, status badge, views, XSS escape) |
| `toggleLayerPicker()` | Mở/đóng popup chọn layer |
| `setBaseLayer(mode)` | Đổi tile layer |
| `toggleSidebar()` | Toggle drawer |
| `showHint(text)` | Hint text trên bản đồ 3 giây |
| `searchLocation()` | Tìm kiếm thông minh |
| `fetchSuggestions(query)` | Nominatim gợi ý |
| `selectResult(item)` | Chọn kết quả Nominatim |
| `initLocationWatch()` | Bắt đầu watch GPS im lặng khi app mở, center bản đồ về vị trí user |
| `startLocationWatch(centerMap, openPopupOnFirst)` | Khởi động `watchPosition` (singleton), icon theo GPS realtime |
| `goToMyLocation()` | Nút 🚩: center về vị trí hiện tại, mở popup |
| `handleMeasureClick(latlng)` | Đo khoảng cách/diện tích |
| `fetchArea(id, lat, lng)` | Nominatim reverse geocode → Firestore |
| `saveXML()` | Xuất XML (File System Access API hoặc fallback download) |
| `importXML(event)` | Import XML → Firestore |
| `esc(str)` | Escape HTML (XSS) |
| `xmlEsc(str)` | Escape XML |
| `ensureOCR()` | Lazy-load Tesseract |
| `parseRealEstateText(text)` | Parse text BĐS (giá, diện tích, hướng, pháp lý...) |
| `parsePrice(t)` | Parse giá (tỷ/triệu/ty, không dấu) |
| `distKm(lat1, lng1, lat2, lng2)` | Tính khoảng cách km bằng công thức Haversine |
| `openQuickView()` | Lấy GPS, lọc BĐS đang bán trong 5km, mở overlay Quick View |
| `showQuickCard(idx)` | Render card BĐS tại index vào `#qv-body`, gọi `incrementCommunityViews`, cập nhật counter và nút |
| `closeQuickView()` | Đóng Quick View overlay |
| `prevQuick()` | Xem BĐS trước trong Quick View |
| `nextQuick()` | Xem BĐS sau trong Quick View |
| `quickViewGoToMap()` | Đóng Quick View, bay đến marker, mở popup sau 900ms |
| `shareLocation(id, name)` | Tạo link Worker, gọi `navigator.share()` (mobile) hoặc copy clipboard (desktop) |
| `parseFirestoreDoc(doc)` | Parse Firestore REST response → object `loc` (dùng trong `handleShareLink`) |
| `handleShareLink(id)` | Fetch `public_locations/{id}` từ Firestore REST, flyTo + mở Quick View (xử lý deep link `?share=ID`) |

---

## PWA & Service Worker

- **Cache key hiện tại:** `bandog-v30`
- **CORE files pre-cached:** `index.html`, `manifest.json`, toàn bộ `lib/` (local — không phụ thuộc CDN)
- **Pre-cache dùng `Promise.allSettled`** — install không fail dù có resource lỗi
- **Chiến lược:**
  - Local files + `lib/`: Cache first
  - External (tiles, Nominatim, Firebase, Firestore, gstatic): Network first, cache fallback
- **Update SW:** tăng `CACHE = 'bandog-vN'` trong `sw.js` → push → user refresh trang

---

## XML export/import

- `<image>` — ảnh đầu tiên (tương thích ngược)
- `<images>` — nhiều URL cách nhau `|||`
- `<status>` — "Đang bán" / "Đã bán"
- `<updatedDate>` — "YYYY-MM-DD"
- Import: ưu tiên `<images>`, fallback `<image>`

---

## Mobile UX

- **Không zoom giao diện:** `<meta name="viewport" ... maximum-scale=1.0 user-scalable=no>` — trình duyệt không cho pinch-zoom hay double-tap zoom UI; Leaflet tự xử lý zoom bản đồ riêng
- **Safe area insets:** (`viewport-fit=cover` đã có) dùng `env(safe-area-inset-top/bottom)` tại:
  - `.modal-overlay` padding — tránh notch/home indicator che modal thêm/sửa
  - `.qv-header` padding-top — tránh status bar che nút ✕ Quick View
  - `.qv-footer` padding-bottom — tránh home indicator che nút điều hướng Quick View
- **Touch swipe Quick View:** IIFE gắn `touchstart`/`touchend` vào `#quickview-overlay`, threshold 55px

---

## Quy trình deploy

```
Sửa Mobile/index.html (và/hoặc sw.js nếu cần bust cache)
  → git add . && git commit -m "..." && git push
  → chờ GitHub Pages build (~1 phút)
  → Người dùng refresh trang (SW tự update khi vào lần sau)
```

---

## Lưu ý kỹ thuật

- **XSS:** mọi dữ liệu qua `esc()` (HTML) hoặc `xmlEsc()` (XML)
- **maxZoom bắt buộc:** `L.map({maxZoom: 19})` — markercluster gọi `map.getMaxZoom()` nội bộ; thiếu → lỗi "Map has no maxZoom specified"
- **Self-hosted libs:** `lib/` trong repo → không bị ảnh hưởng khi CDN (unpkg/cdnjs) down
- **Cluster + popup:** dùng `clusterGroup.zoomToShowLayer(m, cb)` thay vì `m.openPopup()` trực tiếp — cluster cần mở ra trước
- **Single cluster group:** `communityClusterGroup = clusterGroup` (alias). Dùng `removeLayer` từng marker khi clear community, **không** dùng `clearLayers()` — nếu dùng sẽ xóa cả personal markers ra khỏi cluster, gây mất re-clustering khi zoom out
- **Community viewport load (removed event):** Firestore `removed` trong viewport query = document ra ngoài bounds, **không phải xóa thật**. Code bỏ qua toàn bộ `removed` event — markers tích lũy theo thời gian di chuyển, chỉ reset khi đăng nhập/đổi mode
- **Community visibility toggle:** markers được giữ trong `communityMarkers` object khi ẩn → re-add không cần re-fetch Firestore; nút 🌍 dùng `.active` class (xanh = hiện, trắng = ẩn)
- **Community tab filter:** `displayCommunity = communityLocations.filter(loc => loc.ownerUid !== currentUser?.uid)` — tính ngay trong `renderSidebar()`, không ảnh hưởng `communityLocations` gốc
- **GPS watch singleton:** `myLocationWatchId !== null` nghĩa là watch đang chạy. Gọi `startLocationWatch` nhiều lần không tạo nhiều watch — lần sau chỉ re-center
- **Load all vs viewport:** personal locations load toàn bộ 1 lần — không reload khi di chuyển map. Community locations vẫn viewport-based vì dữ liệu người khác có thể rất lớn
- **Views double-count:** `recentlyViewed` Set ngăn đếm 2 lần khi quick view → popup trong 5s. `quickViewItems` là shallow copy từ spread operator nên phải cập nhật `quickViewItems[qIdx].views` riêng (song song với `communityLocations[locIdx].views`) để `showQuickCard` đọc đúng giá trị mới
- **Forgot password:** `auth.sendPasswordResetEmail(email)` — Firebase tự gửi email link reset
- **Firestore offline:** SDK tự cache local, sync lại khi có mạng
- **telegra.ph:** ảnh công khai, vĩnh viễn
- **iOS PWA:** không có push notification, không background sync
- **Nominatim rate limit:** 1 req/s — debounce 400ms (search) / 1100ms (geocode)
- **export.html — Google account:** tài khoản tạo bằng Google Sign-In không có password → phải đặt password trong Firebase Console (Authentication → Users → Reset password) trước khi dùng export.html
