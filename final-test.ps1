$ErrorActionPreference = "Continue"
$baseUrl = "http://localhost:3001"
$results = @()

Write-Host "=== BACKEND SECURITY & VALIDATION FINAL TEST REPORT ===" -ForegroundColor Cyan
Write-Host ""

# Helper function
function Test-API {
    param([string]$Name, [string]$Method, [string]$Endpoint, [object]$Body, [int]$ExpectStatus)
    
    try {
        $params = @{
            Uri = "$baseUrl$Endpoint"
            Method = $Method
            UseBasicParsing = $true
            ErrorAction = "Stop"
        }
        if ($Body) {
            $params.Body = $Body | ConvertTo-Json
            $params.ContentType = "application/json"
        }
        $r = Invoke-WebRequest @params
        $status = $r.StatusCode
        $body = $r.Content
        $pass = $status -eq $ExpectStatus
    } catch {
        $status = $_.Exception.Response.StatusCode.Value__
        $body = ""
        try {
            $s = $_.Exception.Response.GetResponseStream()
            $rd = New-Object System.IO.StreamReader($s)
            $body = $rd.ReadToEnd()
            $rd.Close()
        } catch {}
        $pass = $status -eq $ExpectStatus
    }
    
    $results += @{ Test=$Name; Status=$status; Expected=$ExpectStatus; Pass=$pass; Body=$body }
    return @{ Status=$status; Body=$body; Pass=$pass }
}

# First logout to clear any existing session
Write-Host "Step 1: Clear any existing session..." -ForegroundColor Yellow
Invoke-WebRequest -Uri "$baseUrl/auth/logout" -Method Post -UseBasicParsing | Out-Null
Write-Host "Session cleared." -ForegroundColor Green
Write-Host ""

# ============ TEST SUITE ============
Write-Host "TEST SUITE: AUTHENTICATION" -ForegroundColor Cyan
Write-Host ""

# TEST 1: GET /users without auth = 401
Write-Host "TEST 1: GET /users WITHOUT authentication" -ForegroundColor Yellow
$t1 = Test-API -Name "GET /users (no auth)" -Method Get -Endpoint "/users" -ExpectStatus 401
Write-Host "  Status: $($t1.Status) (Expected: 401)" -ForegroundColor $(if ($t1.Pass) {"Green"} else {"Red"})
Write-Host "  Result: $(if ($t1.Pass) {"PASS"} else {"FAIL"})" -ForegroundColor $(if ($t1.Pass) {"Green"} else {"Red"})
Write-Host ""

# TEST 2: GET /admins without auth = 401
Write-Host "TEST 2: GET /admins WITHOUT authentication" -ForegroundColor Yellow
$t2 = Test-API -Name "GET /admins (no auth)" -Method Get -Endpoint "/admins" -ExpectStatus 401
Write-Host "  Status: $($t2.Status) (Expected: 401)" -ForegroundColor $(if ($t2.Pass) {"Green"} else {"Red"})
Write-Host "  Result: $(if ($t2.Pass) {"PASS"} else {"FAIL"})" -ForegroundColor $(if ($t2.Pass) {"Green"} else {"Red"})
Write-Host ""

# TEST 3: Login
Write-Host "TEST 3: Admin LOGIN" -ForegroundColor Yellow
$loginBody = @{ email = "superadmin@example.com"; password = "superadmin@123" }
$t3 = Test-API -Name "POST /auth/login" -Method Post -Endpoint "/auth/login" -Body $loginBody -ExpectStatus 200
Write-Host "  Status: $($t3.Status) (Expected: 200)" -ForegroundColor $(if ($t3.Pass) {"Green"} else {"Red"})
Write-Host "  Result: $(if ($t3.Pass) {"PASS"} else {"FAIL"})" -ForegroundColor $(if ($t3.Pass) {"Green"} else {"Red"})
Write-Host ""

# TEST 4: GET /users WITH auth = 200
Write-Host "TEST 4: GET /users WITH authentication" -ForegroundColor Yellow
$t4 = Test-API -Name "GET /users (with auth)" -Method Get -Endpoint "/users" -ExpectStatus 200
Write-Host "  Status: $($t4.Status) (Expected: 200)" -ForegroundColor $(if ($t4.Pass) {"Green"} else {"Red"})
$data = $t4.Body | ConvertFrom-Json -ErrorAction SilentlyContinue
if ($data -is [array]) {
    Write-Host "  Data returned: $($data.Count) users" -ForegroundColor Green
}
Write-Host "  Result: $(if ($t4.Pass) {"PASS"} else {"FAIL"})" -ForegroundColor $(if ($t4.Pass) {"Green"} else {"Red"})
Write-Host ""

Write-Host "TEST SUITE: VALIDATION" -ForegroundColor Cyan
Write-Host ""

# TEST 5: PATCH with invalid email = 400
Write-Host "TEST 5: PATCH /users/:id with INVALID email" -ForegroundColor Yellow
$invalidBody = @{ email = "not-an-email"; name = "Test" }
$t5 = Test-API -Name "PATCH invalid email" -Method Patch -Endpoint "/users/usr_001" -Body $invalidBody -ExpectStatus 400
Write-Host "  Status: $($t5.Status) (Expected: 400)" -ForegroundColor $(if ($t5.Pass) {"Green"} else {"Red"})
$errMsg = $t5.Body | ConvertFrom-Json -ErrorAction SilentlyContinue | Select-Object -ExpandProperty message -ErrorAction SilentlyContinue
if ($errMsg) { Write-Host "  Error: $errMsg" -ForegroundColor Yellow }
Write-Host "  Result: $(if ($t5.Pass) {"PASS"} else {"FAIL"})" -ForegroundColor $(if ($t5.Pass) {"Green"} else {"Red"})
Write-Host ""

# TEST 6: PATCH with valid email = 200
Write-Host "TEST 6: PATCH /users/:id with VALID email" -ForegroundColor Yellow
$validBody = @{ email = "alice.valid@example.com"; name = "Alice Valid" }
$t6 = Test-API -Name "PATCH valid email" -Method Patch -Endpoint "/users/usr_001" -Body $validBody -ExpectStatus 200
Write-Host "  Status: $($t6.Status) (Expected: 200)" -ForegroundColor $(if ($t6.Pass) {"Green"} else {"Red"})
$updated = $t6.Body | ConvertFrom-Json -ErrorAction SilentlyContinue
if ($updated.email) { Write-Host "  Saved email: $($updated.email)" -ForegroundColor Green }
Write-Host "  Result: $(if ($t6.Pass) {"PASS"} else {"FAIL"})" -ForegroundColor $(if ($t6.Pass) {"Green"} else {"Red"})
Write-Host ""

# TEST 7: POST with missing required field = 400
Write-Host "TEST 7: POST /users with missing REQUIRED field" -ForegroundColor Yellow
$missingBody = @{ email = "newuser@example.com"; status = "active" }
$t7 = Test-API -Name "POST missing required field" -Method Post -Endpoint "/users" -Body $missingBody -ExpectStatus 400
Write-Host "  Status: $($t7.Status) (Expected: 400)" -ForegroundColor $(if ($t7.Pass) {"Green"} else {"Red"})
$errMsg = $t7.Body | ConvertFrom-Json -ErrorAction SilentlyContinue | Select-Object -ExpandProperty message -ErrorAction SilentlyContinue
if ($errMsg) { Write-Host "  Error: $errMsg" -ForegroundColor Yellow }
Write-Host "  Result: $(if ($t7.Pass) {"PASS"} else {"FAIL"})" -ForegroundColor $(if ($t7.Pass) {"Green"} else {"Red"})
Write-Host ""

# TEST 8: Search/Filter (regression)
Write-Host "TEST 8: Search/Filter Regression Test" -ForegroundColor Yellow
$t8 = Test-API -Name "GET /users with filter" -Method Get -Endpoint "/users?name=Alice%20Valid" -ExpectStatus 200
Write-Host "  Status: $($t8.Status) (Expected: 200)" -ForegroundColor $(if ($t8.Pass) {"Green"} else {"Red"})
$filtered = $t8.Body | ConvertFrom-Json -ErrorAction SilentlyContinue
if ($filtered -is [array]) { Write-Host "  Results: $($filtered.Count) users matched" -ForegroundColor Green }
Write-Host "  Result: $(if ($t8.Pass) {"PASS"} else {"FAIL"})" -ForegroundColor $(if ($t8.Pass) {"Green"} else {"Red"})
Write-Host ""

# TEST 9: Verify passwords sanitized
Write-Host "TEST 9: Verify Password Sanitization" -ForegroundColor Yellow
$t9 = Test-API -Name "GET /admins check sanitization" -Method Get -Endpoint "/admins" -ExpectStatus 200
Write-Host "  Status: $($t9.Status) (Expected: 200)" -ForegroundColor $(if ($t9.Pass) {"Green"} else {"Red"})
$admins = $t9.Body | ConvertFrom-Json -ErrorAction SilentlyContinue
if ($admins -is [array] -and $admins.Count -gt 0) {
    $hasPassword = $admins[0] | Get-Member -Name "password" -ErrorAction SilentlyContinue
    if ($hasPassword) {
        Write-Host "  WARNING: password field exposed!" -ForegroundColor Red
        Write-Host "  Result: FAIL" -ForegroundColor Red
        $t9_pass = $false
    } else {
        Write-Host "  password field properly hidden" -ForegroundColor Green
        Write-Host "  Result: PASS" -ForegroundColor Green
        $t9_pass = $true
    }
} else {
    Write-Host "  Could not verify (no data)" -ForegroundColor Yellow
}
Write-Host ""

# ============ SUMMARY ============
Write-Host "=== SUMMARY ===" -ForegroundColor Cyan
Write-Host ""

$passCount = ($results | Where-Object {$_.Pass}).Count
$totalCount = $results.Count
Write-Host "Tests Passed: $passCount / $totalCount" -ForegroundColor $(if ($passCount -eq $totalCount) {"Green"} else {"Yellow"})
Write-Host ""

if ($passCount -lt $totalCount) {
    Write-Host "Failed Tests:" -ForegroundColor Red
    $results | Where-Object {-not $_.Pass} | ForEach-Object {
        Write-Host "  - $($_.Test): Got $($_.Status), Expected $($_.Expected)" -ForegroundColor Red
    }
} else {
    Write-Host "All automated tests passed!" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== DETAILED TEST RESULTS TABLE ===" -ForegroundColor Cyan
Write-Host ""
$results | Format-Table -Property Test, Status, Expected, @{N="Result";E={if ($_.Pass) {"PASS"} else {"FAIL"}}} -AutoSize
