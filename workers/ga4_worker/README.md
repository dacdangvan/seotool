# GA4 Worker - Google Analytics 4 Integration

Worker để sync dữ liệu traffic thực từ Google Analytics 4 cho **từng project riêng biệt**.

## Tính năng

- ✅ Hỗ trợ **multi-project**: Mỗi project có GA4 Property ID và credentials riêng
- ✅ Credentials lưu trong database (mã hóa)
- ✅ Sync tự động theo lịch (mặc định 6 tiếng/lần)
- ✅ CLI tools để setup và quản lý

## Cài đặt

```bash
cd workers/ga4_worker
npm install
cp .env.example .env
# Edit .env với thông tin database
```

## Database Migration

Chạy migration để thêm fields GA4 vào bảng projects:

```bash
psql -d ai_seo_tool -f ../../database/migrations/008_ga4_integration.sql
```

## Setup GA4 cho Project

### Bước 1: Tạo Service Account tại Google Cloud

1. Vào [Google Cloud Console](https://console.cloud.google.com)
2. Tạo project hoặc chọn project có sẵn
3. Vào **APIs & Services** → **Enable APIs** → Enable **"Google Analytics Data API"**
4. Vào **IAM & Admin** → **Service Accounts** → **Create Service Account**
5. Click vào service account → **Keys** → **Add Key** → **JSON**
6. Download và lưu file JSON key

### Bước 2: Thêm Service Account vào GA4

1. Vào [Google Analytics](https://analytics.google.com)
2. Click **Admin** (icon bánh răng)
3. Vào **Property Access Management**
4. Click **+** để add user
5. Nhập email của Service Account (dạng `xxx@yyy.iam.gserviceaccount.com`)
6. Chọn role **Viewer**

### Bước 3: Lấy GA4 Property ID

1. Trong Google Analytics → **Admin**
2. Vào **Property Settings**
3. Copy **Property ID** (số, ví dụ: `123456789`)

### Bước 4: Setup trong SEO Tool

```bash
# Xem danh sách tất cả projects
npm run setup-project

# Setup GA4 cho một project
npm run setup-project -- \
  --project-id=a1b2c3d4-e5f6-7890-abcd-ef1234567890 \
  --property-id=123456789 \
  --key-file=/path/to/service-account-key.json

# Enable/Disable sync
npm run setup-project -- --project-id=xxx --enable
npm run setup-project -- --project-id=xxx --disable
```

## Sync Data

### Sync một project cụ thể

```bash
npm run sync-project -- --project-id=a1b2c3d4-e5f6-7890-abcd-ef1234567890

# Với số ngày cụ thể
npm run sync-project -- --project-id=xxx --days=7
```

### Sync tất cả projects đã enabled

```bash
npm run sync-all

# Với số ngày cụ thể
npm run sync-all -- --days=7
```

## Chạy Worker (Continuous)

Worker sẽ tự động sync tất cả enabled projects theo lịch:

```bash
# Development (với hot reload)
npm run dev

# Production
npm start
```

Config trong `.env`:
- `SYNC_INTERVAL_HOURS=6` - Sync mỗi 6 tiếng
- `SYNC_DAYS=30` - Sync 30 ngày gần nhất

## Cấu trúc Database

Migration `008_ga4_integration.sql` thêm các fields sau vào bảng `projects`:

| Field | Type | Description |
|-------|------|-------------|
| `ga4_property_id` | VARCHAR(50) | GA4 Property ID |
| `ga4_credentials` | JSONB | Service Account credentials (client_email, private_key) |
| `ga4_last_sync_at` | TIMESTAMP | Lần sync cuối |
| `ga4_sync_enabled` | BOOLEAN | Bật/tắt sync cho project |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run setup-project` | Quản lý GA4 config cho projects |
| `npm run sync-project` | Sync một project cụ thể |
| `npm run sync-all` | Sync tất cả enabled projects |
| `npm run dev` | Chạy worker (development) |
| `npm start` | Chạy worker (production) |
| `npm run test-connection` | Test kết nối GA4 (legacy) |

## Data được Sync

Từ GA4 → bảng `seo_traffic_metrics`:

- `organic_traffic` - Lưu lượng từ organic search
- `total_traffic` - Tổng sessions
- `bounce_rate` - Tỷ lệ thoát
- `avg_session_duration` - Thời gian session trung bình
- `pages_per_session` - Số trang/session

## Ví dụ Output

```
============================================================
GA4 Worker - Multi-Project Sync
============================================================
Sync interval: 6 hours
Sync days: 30

============================================================
[2026-01-27T10:00:00.000Z] Starting GA4 sync cycle
Found 2 project(s) with GA4 enabled
============================================================

📊 [VIB Main Website] Starting sync...
   Domain: vib.com.vn
   GA4 Property: 123456789
   ✅ Synced 30 days of data

📊 [VIB Blog] Starting sync...
   Domain: blog.vib.com.vn
   GA4 Property: 987654321
   ✅ Synced 30 days of data

============================================================
Sync cycle complete: 2 success, 0 failed
Next sync in 6 hours
============================================================
```

## Troubleshooting

### "Permission denied"
- Kiểm tra Service Account đã được add vào GA4 Property Access Management chưa

### "API has not been enabled"
- Vào Google Cloud Console → APIs & Services → Enable "Google Analytics Data API"

### "No projects with GA4 sync enabled"
- Chạy `npm run setup-project` để xem và setup GA4 cho projects
