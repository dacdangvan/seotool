# GSC Worker - Google Search Console Data Sync

Worker để đồng bộ dữ liệu từ Google Search Console vào database.

## Features

- **Search Analytics**: Clicks, impressions, CTR, position theo query, page, country, device
- **Sitemaps**: Trạng thái sitemap, warnings, errors
- **Multi-project support**: Sync dữ liệu cho nhiều projects
- **Incremental sync**: Chỉ sync dữ liệu mới

## Setup

### 1. Install dependencies

```bash
cd workers/gsc_worker
npm install
```

### 2. Configure environment

Tạo file `.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ai_seo_tool
DB_USER=postgres
DB_PASSWORD=postgres
```

### 3. Setup Google Cloud Service Account

1. Vào [Google Cloud Console](https://console.cloud.google.com/)
2. Tạo hoặc chọn project
3. Enable **Search Console API**
4. Tạo Service Account (IAM & Admin → Service Accounts)
5. Tạo và download JSON key

### 4. Configure GSC Access

1. Mở [Google Search Console](https://search.google.com/search-console)
2. Chọn property
3. Vào Settings → Users and permissions
4. Add user với email của service account
5. Cấp quyền **Full** hoặc **Restricted**

### 5. Configure project trong database

Sử dụng frontend Settings → Integrations → GSC hoặc API:

```bash
curl -X PUT http://localhost:3001/projects/{project-id}/gsc/config \
  -H "Content-Type: application/json" \
  -d '{
    "propertyUrl": "https://www.example.com/",
    "serviceAccountKey": {...},
    "syncEnabled": true
  }'
```

## Usage

### Sync all enabled projects

```bash
npm run sync
```

### Sync specific project

```bash
npm run sync:project a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

### Sync với custom date range

```bash
npm run sync -- --days 90
```

## Property URL Format

GSC hỗ trợ 2 loại property:

1. **URL-prefix property**: `https://www.example.com/`
2. **Domain property**: `sc-domain:example.com`

Sử dụng đúng format tùy theo cách bạn đã add property trong GSC.

## Data Tables

### gsc_search_analytics

Stores search performance data:

| Column | Description |
|--------|-------------|
| date | Ngày của data |
| query | Search query |
| page | URL của trang |
| country | Country code (3 letters) |
| device | DESKTOP, MOBILE, TABLET |
| clicks | Số click |
| impressions | Số impressions |
| ctr | Click-through rate |
| position | Average position |

### gsc_sitemaps

Stores sitemap status:

| Column | Description |
|--------|-------------|
| path | URL của sitemap |
| type | sitemap hoặc sitemapIndex |
| warnings_count | Số warnings |
| errors_count | Số errors |
| contents | Chi tiết indexed/submitted counts |

### gsc_url_inspection

Stores URL inspection results (coming soon):

| Column | Description |
|--------|-------------|
| url | URL được inspect |
| coverage_state | SUBMITTED_AND_INDEXED, etc. |
| indexing_state | INDEXING_ALLOWED, etc. |
| mobile_usability_result | MOBILE_FRIENDLY, etc. |

## API Endpoints

Backend cung cấp các endpoints:

- `GET /projects/:id/gsc/config` - Get GSC config
- `PUT /projects/:id/gsc/config` - Update GSC config
- `POST /projects/:id/gsc/sync` - Trigger sync
- `GET /projects/:id/gsc/status` - Get sync status & data summary
- `GET /projects/:id/gsc/analytics` - Get analytics data with filters

## Automation

Để auto-sync hàng ngày, thêm cron job:

```bash
# Sync lúc 6:00 AM mỗi ngày
0 6 * * * cd /path/to/gsc_worker && npm run sync >> /var/log/gsc-sync.log 2>&1
```

## Troubleshooting

### "User does not have sufficient permission"

Service account chưa được add vào GSC property. Vào GSC Settings → Users and permissions để add.

### "Property not found"

Kiểm tra lại property URL. Phải match chính xác với property trong GSC (bao gồm trailing slash cho URL-prefix).

### Rate limiting

GSC API có quota limit. Worker đã có built-in rate limiting, nhưng nếu bị limit, đợi 24h để reset quota.
