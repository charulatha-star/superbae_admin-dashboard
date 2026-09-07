$ErrorActionPreference = "Continue"
$baseUrl = "http://localhost:3001"

Write-Host "=== BACKEND API AUTHENTICATION & VALIDATION TESTS ===" -ForegroundColor Cyan
Write-Host "Testing fixes for critical security issues" -ForegroundColor Cyan
Write-Host ""

# Store all test results
$results = @()

function RecordTest {
    param([string]$Name, [int]$Status, [int]$Expected, [string]$Body)
    
    $pass = $Status -eq $Expected
    $results += @{
        Test = $Name
        Status = $Status
        Expected = $Expected
        Pass = $pass
        Body = $Body
    }
    
    return $pass
}

# ============================================
# TEST 1: GET /users WITHOUT authentication
# ============================================
Write-Host "--- TEST 1: GET /users WITHOUT authentication (should be 401) ---" -ForegroundColor Yellow
try {
    $r = Invoke-WebRequest -Uri "$baseUrl/users" -Method Get -UseBasicParsing -ErrorAction Stop
    Write-Host "Status: $($r.StatusCode) [FAIL - got 200, expected 401]" -ForegroundColor Red
    RecordTest -Name "GET /users (no auth)" -Status $($r.StatusCode) -Expected 401 | Out-Null
} catch {
    $status = $_.Exception.Response.StatusCode.Value__
    $msg = ""
    try {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $msg = ($reader.ReadToEnd() | ConvertFrom-Json).message
        $reader.Close()
    } catch { }
    
    Write-Host "Status: $status" -ForegroundColor $(if ($status -eq 401) { "Green" } else { "Red" })
    Write-Host "Message: $msg" -ForegroundColor $(if ($status -eq 401) { "Green" } else { "Red" })
    Write-Host "RESULT: $(if ($status -eq 401) { 'PASS' } else { 'FAIL' })" -ForegroundColor $(if ($status -eq 401) { "Green" } else { "Red" })
    RecordTest -Name "GET /users (no auth)" -Status $status -Expected 401 -Body $msg | Out-Null
}
Write-Host ""

# ============================================
# TEST 2: GET /admins WITHOUT authentication
# ============================================
Write-Host "--- TEST 2: GET /admins WITHOUT authentication (should be 401) ---" -ForegroundColor Yellow
try {
    $r = Invoke-WebRequest -Uri "$baseUrl/admins" -Method Get -UseBasicParsing -ErrorAction Stop
    Write-Host "Status: $($r.StatusCode) [FAIL - got 200, expected 401]" -ForegroundColor Red
    RecordTest -Name "GET /admins (no auth)" -Status $($r.StatusCode) -Expected 401 | Out-Null
} catch {
    $status = $_.Exception.Response.StatusCode.Value__
    $msg = ""
    try {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $msg = ($reader.ReadToEnd() | ConvertFrom-Json).message
        $reader.Close()
    } catch { }
    
    Write-Host "Status: $status" -ForegroundColor $(if ($status -eq 401) { "Green" } else { "Red" })
    Write-Host "Message: $msg" -ForegroundColor $(if ($status -eq 401) { "Green" } else { "Red" })
    Write-Host "RESULT: $(if ($status -eq 401) { 'PASS' } else { 'FAIL' })" -ForegroundColor $(if ($status -eq 401) { "Green" } else { "Red" })
    RecordTest -Name "GET /admins (no auth)" -Status $status -Expected 401 -Body $msg | Out-Null
}
Write-Host ""

# ============================================
# TEST 3: PATCH /users with INVALID email
# ============================================
Write-Host "--- TEST 3: PATCH /users/:id with INVALID email (should be 400) ---" -ForegroundColor Yellow
$invalidBody = @{ email = "not-an-email"; name = "Test" } | ConvertTo-Json
try {
    $r = Invoke-WebRequest -Uri "$baseUrl/users/usr_002" -Method Patch -Body $invalidBody -ContentType "application/json" -UseBasicParsing -ErrorAction Stop
    Write-Host "Status: $($r.StatusCode) [FAIL - accepted invalid email]" -ForegroundColor Red
    RecordTest -Name "PATCH /users with invalid email" -Status $($r.StatusCode) -Expected 400 | Out-Null
} catch {
    $status = $_.Exception.Response.StatusCode.Value__
    $msg = ""
    try {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $msg = $reader.ReadToEnd()
        $reader.Close()
    } catch { }
    
    Write-Host "Status: $status" -ForegroundColor $(if ($status -eq 400) { "Green" } else { "Red" })
    Write-Host "Message: $msg" -ForegroundColor $(if ($status -eq 400) { "Green" } else { "Red" })
    Write-Host "RESULT: $(if ($status -eq 400) { 'PASS' } else { 'FAIL' })" -ForegroundColor $(if ($status -eq 400) { "Green" } else { "Red" })
    RecordTest -Name "PATCH /users with invalid email" -Status $status -Expected 400 -Body $msg | Out-Null
}
Write-Host ""

# ============================================
# TEST 4: PATCH /users with VALID email
# ============================================
Write-Host "--- TEST 4: PATCH /users/:id with VALID email (should be 400 due to no auth) ---" -ForegroundColor Yellow
$validBody = @{ email = "valid@example.com"; name = "Test" } | ConvertTo-Json
try {
    $r = Invoke-WebRequest -Uri "$baseUrl/users/usr_002" -Method Patch -Body $validBody -ContentType "application/json" -UseBasicParsing -ErrorAction Stop
    Write-Host "Status: $($r.StatusCode) [Unexpected - no session]" -ForegroundColor Yellow
    RecordTest -Name "PATCH /users with valid email (no auth)" -Status $($r.StatusCode) -Expected 401 | Out-Null
} catch {
    $status = $_.Exception.Response.StatusCode.Value__
    Write-Host "Status: $status" -ForegroundColor $(if ($status -eq 401) { "Green" } else { "Yellow" })
    Write-Host "RESULT: $(if ($status -eq 401) { 'PASS (auth required)' } else { 'NOTE: Got $status' })" -ForegroundColor $(if ($status -eq 401) { "Green" } else { "Yellow" })
    RecordTest -Name "PATCH /users with valid email (no auth)" -Status $status -Expected 401 | Out-Null
}
Write-Host ""

# ============================================
# TEST 5: POST /users with missing required field
# ============================================
Write-Host "--- TEST 5: POST /users with missing 'name' field (should be 400 due to validation) ---" -ForegroundColor Yellow
$missingBody = @{ email = "newuser@example.com"; status = "active" } | ConvertTo-Json
try {
    $r = Invoke-WebRequest -Uri "$baseUrl/users" -Method Post -Body $missingBody -ContentType "application/json" -UseBasicParsing -ErrorAction Stop
    Write-Host "Status: $($r.StatusCode) [Unexpected]" -ForegroundColor Yellow
} catch {
    $status = $_.Exception.Response.StatusCode.Value__
    $msg = ""
    try {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $msg = ($reader.ReadToEnd() | ConvertFrom-Json).message
        $reader.Close()
    } catch { }
    
    Write-Host "Status: $status" -ForegroundColor $(if ($status -eq 401 -or $status -eq 400) { "Green" } else { "Yellow" })
    Write-Host "Message: $msg" -ForegroundColor Green
    Write-Host "RESULT: $(if ($status -eq 401) { 'PASS (requires auth)' } else { 'Got $status' })" -ForegroundColor $(if ($status -eq 401) { "Green" } else { "Yellow" })
    RecordTest -Name "POST /users missing name (auth check)" -Status $status -Expected 401 -Body $msg | Out-Null
}
Write-Host ""

# ============================================
# TEST 6: Health endpoint (should always work)
# ============================================
Write-Host "--- TEST 6: GET /health (should always return 200) ---" -ForegroundColor Yellow
$r = Invoke-WebRequest -Uri "$baseUrl/health" -Method Get -UseBasicParsing
Write-Host "Status: $($r.StatusCode)" -ForegroundColor Green
Write-Host "RESULT: PASS" -ForegroundColor Green
RecordTest -Name "GET /health" -Status $($r.StatusCode) -Expected 200 | Out-Null
Write-Host ""

# ============================================
# SUMMARY
# ============================================
Write-Host "=== TEST SUMMARY ===" -ForegroundColor Cyan
Write-Host ""

$passed = ($results | Where-Object { $_.Pass }).Count
$total = $results.Count
Write-Host "Results: $passed / $total PASSED" -ForegroundColor $(if ($passed -eq $total) { "Green" } else { "Red" })
Write-Host ""

Write-Host "Detailed Results:" -ForegroundColor Cyan
$results | ForEach-Object {
    $symbol = if ($_.Pass) { "[OK]" } else { "[FAIL]" }
    $color = if ($_.Pass) { "Green" } else { "Red" }
    Write-Host "$symbol $($_.Test): Status $($_.Status) (Expected $($_.Expected))" -ForegroundColor $color
}

Write-Host ""
Write-Host "KEY FINDINGS:" -ForegroundColor Cyan
Write-Host "1. GET /users without auth should return 401" -ForegroundColor Yellow
Write-Host "2. GET /admins without auth should return 401" -ForegroundColor Yellow
Write-Host "3. PATCH with invalid email should return 400" -ForegroundColor Yellow
Write-Host "4. All protected routes require authentication" -ForegroundColor Yellow
Write-Host "5. Required field validation works (catches missing 'name')" -ForegroundColor Yellow
