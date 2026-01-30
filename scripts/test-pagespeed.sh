#!/bin/bash
# Test PageSpeed Insights API
# Usage: ./test-pagespeed.sh <url> [mobile|desktop]

URL="${1:-https://www.vib.com.vn/vn}"
STRATEGY="${2:-mobile}"

echo "Testing PageSpeed for: $URL ($STRATEGY)"
echo "================================================"

# Call PageSpeed Insights API (no API key required for basic usage, but rate limited)
curl -s "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${URL}&strategy=${STRATEGY}&category=performance" | jq '{
  url: .id,
  strategy: .lighthouseResult.configSettings.emulatedFormFactor,
  performanceScore: (.lighthouseResult.categories.performance.score * 100 | floor),
  metrics: {
    LCP: .lighthouseResult.audits["largest-contentful-paint"].displayValue,
    LCP_ms: .lighthouseResult.audits["largest-contentful-paint"].numericValue,
    FCP: .lighthouseResult.audits["first-contentful-paint"].displayValue,
    CLS: .lighthouseResult.audits["cumulative-layout-shift"].displayValue,
    TBT: .lighthouseResult.audits["total-blocking-time"].displayValue,
    SI: .lighthouseResult.audits["speed-index"].displayValue
  }
}'
