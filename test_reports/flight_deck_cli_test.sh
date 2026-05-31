#!/bin/bash
# Flight Deck + CLI Control Plane Completion Pass test script
set +e

BASE_LOCAL="http://localhost:3000"
BASE_PUB="${REACT_APP_BACKEND_URL:-https://token-monetization.preview.emergentagent.com}"

PASS=0
FAIL=0
declare -a FAILURES

check() {
  local name="$1"
  local cond="$2"
  if [ "$cond" = "1" ]; then
    echo "PASS: $name"
    PASS=$((PASS+1))
  else
    echo "FAIL: $name"
    FAIL=$((FAIL+1))
    FAILURES+=("$name")
  fi
}

echo "=== 1. Manifest endpoint (public) ==="
MANIFEST=$(curl -s -w '\n__STATUS__%{http_code}' "$BASE_LOCAL/api/flight-deck/manifest")
M_STATUS=$(echo "$MANIFEST" | grep __STATUS__ | sed 's/.*__STATUS__//')
M_BODY=$(echo "$MANIFEST" | sed '/__STATUS__/d')
echo "Status: $M_STATUS"
AVAIL=$(echo "$M_BODY" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("available_count",0))')
echo "available_count=$AVAIL"
echo "$M_BODY" | python3 -c 'import sys,json;d=json.load(sys.stdin);
artifacts=d.get("artifacts",[]);
print("total artifacts:",len(artifacts));
for a in artifacts:
  print(" -", a.get("filename"), a.get("available"), a.get("size"), a.get("sha256","")[:16])
'
[ "$M_STATUS" = "200" ] && check "manifest_200" 1 || check "manifest_200" 0
[ "$AVAIL" -ge "2" ] && check "manifest_available_count_>=2" 1 || check "manifest_available_count_>=2" 0

# verify .deb and .AppImage entries exist with sha256+size+download_url
HAS_DEB=$(echo "$M_BODY" | python3 -c '
import sys,json
d=json.load(sys.stdin)
ok=False
for a in d.get("artifacts",[]):
  if "linux-arm64.deb" in a.get("filename","") and a.get("sha256") and a.get("size") and a.get("download_url"):
    ok=True
print(1 if ok else 0)')
check "manifest_has_linux_arm64_deb_with_metadata" "$HAS_DEB"

HAS_APP=$(echo "$M_BODY" | python3 -c '
import sys,json
d=json.load(sys.stdin)
ok=False
for a in d.get("artifacts",[]):
  if "linux-arm64.AppImage" in a.get("filename","") and a.get("sha256") and a.get("size") and a.get("download_url"):
    ok=True
print(1 if ok else 0)')
check "manifest_has_linux_arm64_AppImage_with_metadata" "$HAS_APP"

echo ""
echo "=== 2. Download .deb ==="
DEB_HDRS=$(curl -s -D - -o /tmp/dl.deb "$BASE_LOCAL/api/flight-deck/download/v0.1.0/baseline-flight-deck_0.1.0_linux-arm64.deb")
DEB_STATUS=$(echo "$DEB_HDRS" | head -1 | awk '{print $2}')
DEB_CT=$(echo "$DEB_HDRS" | grep -i '^content-type' | head -1 | tr -d '\r')
DEB_CD=$(echo "$DEB_HDRS" | grep -i '^content-disposition' | head -1 | tr -d '\r')
DEB_CL=$(echo "$DEB_HDRS" | grep -i '^content-length' | head -1 | tr -d '\r' | awk '{print $2}')
DEB_SHA=$(sha256sum /tmp/dl.deb | awk '{print $1}')
echo "Status: $DEB_STATUS"
echo "CT: $DEB_CT"
echo "CD: $DEB_CD"
echo "CL: $DEB_CL"
echo "SHA: $DEB_SHA"
[ "$DEB_STATUS" = "200" ] && check "deb_status_200" 1 || check "deb_status_200" 0
echo "$DEB_CT" | grep -qi 'application/vnd.debian.binary-package' && check "deb_content_type" 1 || check "deb_content_type" 0
echo "$DEB_CD" | grep -qi 'attachment' && check "deb_content_disposition_attachment" 1 || check "deb_content_disposition_attachment" 0
[ "$DEB_CL" = "4216898" ] && check "deb_content_length_4216898" 1 || check "deb_content_length_4216898" 0
[ "$DEB_SHA" = "052130815271a6b92df4c3fa3b9f6b040ad9a1bfbc58ef60873aee0cfc3245ed" ] && check "deb_sha256_match" 1 || check "deb_sha256_match" 0

echo ""
echo "=== 3. Download .AppImage ==="
APP_HDRS=$(curl -s -D - -o /tmp/dl.AppImage "$BASE_LOCAL/api/flight-deck/download/v0.1.0/baseline-flight-deck_0.1.0_linux-arm64.AppImage")
APP_STATUS=$(echo "$APP_HDRS" | head -1 | awk '{print $2}')
APP_CL=$(echo "$APP_HDRS" | grep -i '^content-length' | head -1 | tr -d '\r' | awk '{print $2}')
APP_SHA=$(sha256sum /tmp/dl.AppImage | awk '{print $1}')
echo "Status: $APP_STATUS  CL: $APP_CL  SHA: $APP_SHA"
[ "$APP_STATUS" = "200" ] && check "appimage_status_200" 1 || check "appimage_status_200" 0
[ "$APP_CL" = "94386696" ] && check "appimage_content_length_94386696" 1 || check "appimage_content_length_94386696" 0
[ "$APP_SHA" = "511ccd2e634c4fae26025906fb79110556324a4bd3901e509cf3ec932aa7cc03" ] && check "appimage_sha256_match" 1 || check "appimage_sha256_match" 0

echo ""
echo "=== 4. Path traversal blocked ==="
PT_STATUS=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_LOCAL/api/flight-deck/download/v0.1.0/../etc/passwd")
echo "Status: $PT_STATUS"
{ [ "$PT_STATUS" = "400" ] || [ "$PT_STATUS" = "403" ]; } && check "path_traversal_blocked" 1 || check "path_traversal_blocked" 0

echo ""
echo "=== 5. Non-allowlist file ==="
NL_STATUS=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_LOCAL/api/flight-deck/download/v0.1.0/nonexistent.deb")
echo "Status: $NL_STATUS"
[ "$NL_STATUS" = "400" ] && check "nonexistent_returns_400" 1 || check "nonexistent_returns_400" 0

echo ""
echo "=== 6. Manifest PUBLIC over preview URL ==="
PUB_STATUS=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_PUB/api/flight-deck/manifest")
echo "Status: $PUB_STATUS"
[ "$PUB_STATUS" = "200" ] && check "manifest_public_via_preview" 1 || check "manifest_public_via_preview" 0

echo ""
echo "=== Results: PASS=$PASS FAIL=$FAIL ==="
for f in "${FAILURES[@]}"; do echo "  - $f"; done
