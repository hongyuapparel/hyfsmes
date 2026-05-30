# Self-test: create production order, push through stages, verify byColor preserved.
# All Chinese values in JSON payloads use \uXXXX escape so PS file encoding cannot mangle them.
# Decodes:
#   白色 = bai-se = white color
#   黄色 = huang-se = yellow color
#   自测客户 = zi-ce ke-hu = self-test customer
#   自测业务 = self-test business
#   自测跟单 = self-test follow
#   本厂 = ben-chang = home factory
#   自测裁床 = self-test cutter
$ErrorActionPreference = "Stop"
$envPath = "E:\1.Cursor-Project\6. hyfsmes\backend\.env"
$envLines = Get-Content $envPath
$pwdLine = ($envLines | Where-Object { $_ -match "^MYSQL_PASSWORD=" } | Select-Object -First 1)
$env:MYSQL_PWD = ($pwdLine -replace "^MYSQL_PASSWORD=", "").Trim()
$mysql = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"

# 1. Login (admin credentials read from backend/.env so password is not hardcoded)
$adminUser = ($envLines | Where-Object { $_ -match "^ADMIN_USERNAME=" } | Select-Object -First 1) -replace "^ADMIN_USERNAME=", ""
$adminPwd  = ($envLines | Where-Object { $_ -match "^ADMIN_PASSWORD=" } | Select-Object -First 1) -replace "^ADMIN_PASSWORD=", ""
if ([string]::IsNullOrWhiteSpace($adminUser)) { $adminUser = "admin" }
if ([string]::IsNullOrWhiteSpace($adminPwd))  { throw "ADMIN_PASSWORD not found in backend/.env" }
$loginBody = '{"username":"' + $adminUser.Trim() + '","password":"' + $adminPwd.Trim() + '"}'
$login = Invoke-RestMethod -Uri "http://localhost:3000/auth/login" -Method POST -ContentType "application/json" -Body $loginBody
$token = $login.access_token; if (-not $token) { $token = $login.accessToken }
$h = @{ Authorization = "Bearer $token" }
function PostJson([string]$url, [string]$body) {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
  return Invoke-RestMethod -Uri $url -Method POST -Headers $h -ContentType "application/json; charset=utf-8" -Body $bytes
}
Write-Output "==> Logged in"

# 2. Create order with 2 colors (white/yellow) x 4 sizes (S/M/L/XL)
$payload = @'
{
  "skuCode": "SELFTEST-001",
  "customerName": "自测客户",
  "salesperson": "自测业务",
  "merchandiser": "自测跟单",
  "quantity": 100,
  "exFactoryPrice": "10.00",
  "salePrice": "15.00",
  "orderDate": "2026-05-30",
  "customerDueDate": "2026-06-30",
  "orderTypeId": 5,
  "collaborationTypeId": 12,
  "colorSizeHeaders": ["S", "M", "L", "XL"],
  "colorSizeRows": [
    { "colorName": "白色", "quantities": [10, 15, 15, 10] },
    { "colorName": "黄色", "quantities": [10, 15, 15, 10] }
  ]
}
'@
$created = PostJson "http://localhost:3000/orders" $payload
$orderId = $created.id
Write-Output "==> Created order id=$orderId orderNo=$($created.orderNo)"

# 3. Push to pending_cutting
Start-Sleep -Milliseconds 500
$null = & $mysql -u root -h localhost erp -e "UPDATE orders SET status='pending_cutting', order_type_id=5, collaboration_type_id=12 WHERE id=$orderId"
Start-Sleep -Milliseconds 500
$stsCheck = & $mysql -u root -h localhost erp --batch --skip-column-names -e "SELECT status FROM orders WHERE id=$orderId"
Write-Output "==> status now: $stsCheck"
if ($stsCheck.Trim() -ne "pending_cutting") {
  Start-Sleep -Milliseconds 2000
  $null = & $mysql -u root -h localhost erp -e "UPDATE orders SET status='pending_cutting', order_type_id=5, collaboration_type_id=12 WHERE id=$orderId"
  Start-Sleep -Milliseconds 500
  $stsCheck = & $mysql -u root -h localhost erp --batch --skip-column-names -e "SELECT status FROM orders WHERE id=$orderId"
  Write-Output "==> status retry: $stsCheck"
}

# 4. Cutting register
$cutPayload = @"
{
  "orderId": $orderId,
  "cuttingDepartment": "本厂",
  "cutterName": "自测裁床",
  "actualCutRows": [
    { "colorName": "白色", "quantities": [11, 14, 16, 10] },
    { "colorName": "黄色", "quantities": [9, 16, 14, 11] }
  ]
}
"@
PostJson "http://localhost:3000/production/cutting/items/complete" $cutPayload | Out-Null
Write-Output "==> Cutting registered"
$cutVerify = & $mysql -u root -h localhost erp --batch --skip-column-names -e "SELECT JSON_UNQUOTE(actual_cut_rows) AS v FROM order_cutting WHERE order_id=$orderId"
Write-Output "  actual_cut_rows: $cutVerify"

# 5. Push to pending_sewing
$null = & $mysql -u root -h localhost erp -e "UPDATE orders SET status='pending_sewing' WHERE id=$orderId; UPDATE order_cutting SET status='completed' WHERE order_id=$orderId"
Start-Sleep -Milliseconds 300

# 6. Sewing: ensure order_sewing row + complete
$null = & $mysql -u root -h localhost erp -e "INSERT INTO order_sewing (order_id, status, distributed_at, factory_due_date) VALUES ($orderId, 'pending_receive', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY)) ON DUPLICATE KEY UPDATE status='pending_receive'"
Start-Sleep -Milliseconds 300
$sewPayload = @"
{
  "orderId": $orderId,
  "sewingQuantity": 100,
  "sewingQuantitiesByColor": [
    { "colorName": "白色", "quantities": [10, 14, 16, 10] },
    { "colorName": "黄色", "quantities": [10, 15, 14, 11] }
  ]
}
"@
PostJson "http://localhost:3000/production/sewing/items/complete" $sewPayload | Out-Null
Write-Output "==> Sewing registered"
$sewVerify = & $mysql -u root -h localhost erp --batch --skip-column-names -e "SELECT JSON_UNQUOTE(sewing_quantities_by_color) AS v FROM order_sewing WHERE order_id=$orderId"
Write-Output "  sewing_quantities_by_color: $sewVerify"

# 7. Push to pending_finishing
$null = & $mysql -u root -h localhost erp -e "UPDATE orders SET status='pending_finishing' WHERE id=$orderId"
Start-Sleep -Milliseconds 300

# 8. Finishing receive
$receivePayload = @"
{
  "orderId": $orderId,
  "tailReceivedQty": 100,
  "tailReceivedQuantitiesByColor": [
    { "colorName": "白色", "quantities": [10, 15, 15, 10] },
    { "colorName": "黄色", "quantities": [10, 15, 15, 10] }
  ]
}
"@
PostJson "http://localhost:3000/production/finishing/items/register-receive" $receivePayload | Out-Null
Write-Output "==> Receive registered"
$rcvVerify = & $mysql -u root -h localhost erp --batch --skip-column-names -e "SELECT JSON_UNQUOTE(tail_received_quantities_by_color) AS v FROM order_finishing WHERE order_id=$orderId"
Write-Output "  tail_received_quantities_by_color: $rcvVerify"

# 9. Packaging-complete (inbound 95 + defect 5)
$pkgPayload = @"
{
  "orderId": $orderId,
  "mode": "full",
  "tailInboundQty": 95,
  "defectQuantity": 5,
  "tailInboundQuantitiesByColor": [
    { "colorName": "白色", "quantities": [10, 14, 14, 10] },
    { "colorName": "黄色", "quantities": [9, 15, 14, 9] }
  ],
  "defectQuantitiesByColor": [
    { "colorName": "白色", "quantities": [0, 1, 1, 0] },
    { "colorName": "黄色", "quantities": [1, 0, 1, 1] }
  ]
}
"@
PostJson "http://localhost:3000/production/finishing/items/register-packaging-complete" $pkgPayload | Out-Null
Write-Output "==> Packaging-complete registered"
$inbVerify = & $mysql -u root -h localhost erp --batch --skip-column-names -e "SELECT JSON_UNQUOTE(tail_inbound_quantities_by_color) AS v FROM order_finishing WHERE order_id=$orderId"
Write-Output "  tail_inbound_quantities_by_color: $inbVerify"
$defVerify = & $mysql -u root -h localhost erp --batch --skip-column-names -e "SELECT JSON_UNQUOTE(defect_quantities_by_color) AS v FROM order_finishing WHERE order_id=$orderId"
Write-Output "  defect_quantities_by_color: $defVerify"
$snapVerify = & $mysql -u root -h localhost erp --batch --skip-column-names -e "SELECT id, source_type, quantity, JSON_UNQUOTE(color_size_snapshot) FROM inbound_pending WHERE order_id=$orderId ORDER BY id"
Write-Output "==> inbound_pending rows:"
Write-Output $snapVerify

# 10. Verify via size-breakdown
$bd = Invoke-RestMethod -Uri "http://localhost:3000/orders/$orderId/size-breakdown" -Headers $h
Write-Output "==> size-breakdown rows: $(($bd.rows | ForEach-Object { $_.label }) -join ',')"
foreach ($block in $bd.byColor) {
    Write-Output "  [$($block.colorName)]"
    foreach ($r in $block.rows) {
        Write-Output "    $($r.label): $($r.values -join ',')"
    }
}

# 11. Sum verify
Write-Output ""
Write-Output "==> Sum verify (Excel strict)"
$allOk = $true
foreach ($block in $bd.byColor) {
    foreach ($r in $block.rows) {
        $vals = $r.values
        $totalCol = $vals[$vals.Length - 1]
        $sum = 0
        for ($i = 0; $i -lt $vals.Length - 1; $i++) { $sum += [int]$vals[$i] }
        if ($sum -eq [int]$totalCol) {
            Write-Output "  [$($block.colorName)] $($r.label): OK"
        } else {
            Write-Output "  [$($block.colorName)] $($r.label): FAIL(sum=$sum total=$totalCol)"
            $allOk = $false
        }
    }
}
Write-Output ""
if ($allOk) { Write-Output "==> ALL SUM CHECKS PASSED" } else { Write-Output "==> SUM CHECK FAILED" }
Write-Output ""
Write-Output "==> Test order preserved: id=$orderId orderNo=$($created.orderNo)"
$env:MYSQL_PWD = $null
