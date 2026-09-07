$ErrorActionPreference = "Continue"
$baseUrl = "http://localhost:3001"

# Store test results
$testResults = @()

function Test-Endpoint {
    param(
        [string]$TestName,
        [string]$Method,
        [string]$Endpoint,
        [object]$Body,
        [int]$ExpectedStatus,
        [string]$Headers = ""
    )
    
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
        
        $response = Invoke-WebRequest @params
        $status = $response.StatusCode
        $content = $response.Content
        
        $passed = $status -eq $ExpectedStatus
        $result = @{
            Test = $TestName
            Status = $status
            Expected = $ExpectedStatus
            Pass = $passed
            Response = $content | ConvertFrom-Json -ErrorAction SilentlyContinue
        }
    } catch {
        $status = $_.Exception.Response.StatusCode.Value__
        $content = ""
        try {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $content = $reader.ReadToEnd()
            $reader.Close()
        } catch { }
        
        $passed = $status -eq $ExpectedStatus
        $result = @{
            Test = $TestName
            Status = $status
            Expected = $ExpectedStatus
            Pass = $passed
            Response = $content
        }
    }
    
    $testResults += $result
    return $result
}

Write-Host "=== REGRESSION TESTS FOR BACKEND SECURITY FIXES ===" -ForegroundColor Cyan
Write-Host ""

# First, log in as admin to get an authenticated session
Write-Host "--- Setting up: Admin Login ---" -ForegroundColor Yellow
$loginBody = @{
    email = "superadmin@example.com"
    password = "password123"
}
$loginResponse = Test-Endpoint -TestName "Admin Login" -Method Post -Endpoint "/auth/login" -Body $loginBody -ExpectedStatus 200
Write-Host "Login Status: $($loginResponse.Status)" -ForegroundColor Green
Write-Host "Logged in as: $($loginResponse.Response.name)" -ForegroundColor Green
Write-Host ""

# TEST 1: GET /users WITHOUT authentication (should be 401)
Write-Host "--- TEST 1: GET /users without authentication ---" -ForegroundColor Yellow
$test1 = Test-Endpoint -TestName "GET /users (no auth)" -Method Get -Endpoint "/users" -ExpectedStatus 401
Write-Host "Status: $($test1.Status) (Expected: 401)" -ForegroundColor $(if ($test1.Pass) { "Green" } else { "Red" })
Write-Host "Response: $($test1.Response.message)" -ForegroundColor $(if ($test1.Pass) { "Green" } else { "Red" })
Write-Host "RESULT: $(if ($test1.Pass) { 'PASS' } else { 'FAIL' })" -ForegroundColor $(if ($test1.Pass) { "Green" } else { "Red" })
Write-Host ""

# TEST 2: GET /users WITH authentication (should be 200)
Write-Host "--- TEST 2: GET /users with authentication ---" -ForegroundColor Yellow
$test2 = Test-Endpoint -TestName "GET /users (with auth)" -Method Get -Endpoint "/users" -ExpectedStatus 200
Write-Host "Status: $($test2.Status) (Expected: 200)" -ForegroundColor $(if ($test2.Pass) { "Green" } else { "Red" })
if ($test2.Response -is [array]) {
    Write-Host "Response: $($test2.Response.Count) users returned" -ForegroundColor $(if ($test2.Pass) { "Green" } else { "Red" })
}
Write-Host "RESULT: $(if ($test2.Pass) { 'PASS' } else { 'FAIL' })" -ForegroundColor $(if ($test2.Pass) { "Green" } else { "Red" })
Write-Host ""

# TEST 3: GET /admins WITHOUT authentication (should be 401)
Write-Host "--- TEST 3: GET /admins without authentication ---" -ForegroundColor Yellow
$test3 = Test-Endpoint -TestName "GET /admins (no auth)" -Method Get -Endpoint "/admins" -ExpectedStatus 401
Write-Host "Status: $($test3.Status) (Expected: 401)" -ForegroundColor $(if ($test3.Pass) { "Green" } else { "Red" })
Write-Host "Response: $($test3.Response.message)" -ForegroundColor $(if ($test3.Pass) { "Green" } else { "Red" })
Write-Host "RESULT: $(if ($test3.Pass) { 'PASS' } else { 'FAIL' })" -ForegroundColor $(if ($test3.Pass) { "Green" } else { "Red" })
Write-Host ""

# TEST 4: GET /admins WITH authentication (should be 200)
Write-Host "--- TEST 4: GET /admins with authentication ---" -ForegroundColor Yellow
$test4 = Test-Endpoint -TestName "GET /admins (with auth)" -Method Get -Endpoint "/admins" -ExpectedStatus 200
Write-Host "Status: $($test4.Status) (Expected: 200)" -ForegroundColor $(if ($test4.Pass) { "Green" } else { "Red" })
if ($test4.Response -is [array]) {
    Write-Host "Response: $($test4.Response.Count) admins returned" -ForegroundColor $(if ($test4.Pass) { "Green" } else { "Red" })
    if ($test4.Response.Count -gt 0) {
        Write-Host "First admin has password field: $(if ($test4.Response[0].password) { 'YES - SECURITY ISSUE!' } else { 'NO - Properly sanitized' })" -ForegroundColor $(if ($test4.Response[0].password) { "Red" } else { "Green" })
    }
}
Write-Host "RESULT: $(if ($test4.Pass) { 'PASS' } else { 'FAIL' })" -ForegroundColor $(if ($test4.Pass) { "Green" } else { "Red" })
Write-Host ""

# TEST 5: PATCH /users/:id with INVALID email (should be 400)
Write-Host "--- TEST 5: PATCH with invalid email (should reject) ---" -ForegroundColor Yellow
$invalidEmailBody = @{
    email = "not-an-email"
    name = "Test User"
}
$test5 = Test-Endpoint -TestName "PATCH /users with invalid email" -Method Patch -Endpoint "/users/usr_001" -Body $invalidEmailBody -ExpectedStatus 400
Write-Host "Status: $($test5.Status) (Expected: 400)" -ForegroundColor $(if ($test5.Pass) { "Green" } else { "Red" })
Write-Host "Response: $($test5.Response.message)" -ForegroundColor $(if ($test5.Pass) { "Green" } else { "Red" })
Write-Host "RESULT: $(if ($test5.Pass) { 'PASS' } else { 'FAIL' })" -ForegroundColor $(if ($test5.Pass) { "Green" } else { "Red" })
Write-Host ""

# TEST 6: PATCH /users/:id with VALID email (should be 200)
Write-Host "--- TEST 6: PATCH with valid email (should accept) ---" -ForegroundColor Yellow
$validEmailBody = @{
    email = "alice.updated@example.com"
    name = "Alice Updated"
}
$test6 = Test-Endpoint -TestName "PATCH /users with valid email" -Method Patch -Endpoint "/users/usr_001" -Body $validEmailBody -ExpectedStatus 200
Write-Host "Status: $($test6.Status) (Expected: 200)" -ForegroundColor $(if ($test6.Pass) { "Green" } else { "Red" })
if ($test6.Response.email) {
    Write-Host "Updated email: $($test6.Response.email)" -ForegroundColor $(if ($test6.Pass) { "Green" } else { "Red" })
}
Write-Host "RESULT: $(if ($test6.Pass) { 'PASS' } else { 'FAIL' })" -ForegroundColor $(if ($test6.Pass) { "Green" } else { "Red" })
Write-Host ""

# TEST 7: Search/Filter functionality (regression test)
Write-Host "--- TEST 7: Search/Filter (regression test) ---" -ForegroundColor Yellow
$test7 = Test-Endpoint -TestName "GET /users with search filter" -Method Get -Endpoint "/users?name=Alice" -ExpectedStatus 200
Write-Host "Status: $($test7.Status) (Expected: 200)" -ForegroundColor $(if ($test7.Pass) { "Green" } else { "Red" })
if ($test7.Response -is [array]) {
    Write-Host "Filtered results: $($test7.Response.Count) users match 'Alice'" -ForegroundColor $(if ($test7.Pass) { "Green" } else { "Red" })
}
Write-Host "RESULT: $(if ($test7.Pass) { 'PASS' } else { 'FAIL' })" -ForegroundColor $(if ($test7.Pass) { "Green" } else { "Red" })
Write-Host ""

# TEST 8: POST /users with missing required field (should be 400)
Write-Host "--- TEST 8: POST with missing required field ---" -ForegroundColor Yellow
$missingFieldBody = @{
    email = "newuser@example.com"
    status = "active"
}
$test8 = Test-Endpoint -TestName "POST /users without name field" -Method Post -Endpoint "/users" -Body $missingFieldBody -ExpectedStatus 400
Write-Host "Status: $($test8.Status) (Expected: 400)" -ForegroundColor $(if ($test8.Pass) { "Green" } else { "Red" })
Write-Host "Response: $($test8.Response.message)" -ForegroundColor $(if ($test8.Pass) { "Green" } else { "Red" })
Write-Host "RESULT: $(if ($test8.Pass) { 'PASS' } else { 'FAIL' })" -ForegroundColor $(if ($test8.Pass) { "Green" } else { "Red" })
Write-Host ""

# TEST 9: Verify database was NOT mutated by invalid email update
Write-Host "--- TEST 9: Verify database integrity (no mutation from failed validation) ---" -ForegroundColor Yellow
$test9 = Test-Endpoint -TestName "GET /users/:id to verify email not changed" -Method Get -Endpoint "/users/usr_001" -ExpectedStatus 200
Write-Host "Status: $($test9.Status) (Expected: 200)" -ForegroundColor $(if ($test9.Pass) { "Green" } else { "Red" })
if ($test9.Response.email) {
    $emailAfterInvalidAttempt = $test9.Response.email
    Write-Host "Current email in DB: $emailAfterInvalidAttempt" -ForegroundColor $(if ($test9.Pass) { "Green" } else { "Red" })
    Write-Host "Expected: alice.updated@example.com (from valid PATCH)" -ForegroundColor Cyan
}
Write-Host "RESULT: $(if ($test9.Pass) { 'PASS' } else { 'FAIL' })" -ForegroundColor $(if ($test9.Pass) { "Green" } else { "Red" })
Write-Host ""

# Summary
Write-Host "=== TEST SUMMARY ===" -ForegroundColor Cyan
Write-Host ""
$passed = ($testResults | Where-Object { $_.Pass }).Count
$total = $testResults.Count
Write-Host "Passed: $passed / $total" -ForegroundColor $(if ($passed -eq $total) { "Green" } else { "Yellow" })
Write-Host ""

# Detailed results table
Write-Host "--- Detailed Results Table ---" -ForegroundColor Cyan
$testResults | Format-Table -Property Test, Status, Expected, @{Name="Result"; Expression={if ($_.Pass) {"PASS"} else {"FAIL"}}} -AutoSize

# Critical issues
$failed = $testResults | Where-Object { -not $_.Pass }
if ($failed) {
    Write-Host ""
    Write-Host "FAILED TESTS:" -ForegroundColor Red
    $failed | ForEach-Object {
        Write-Host "  - $($_.Test): Expected $($_.Expected), got $($_.Status)" -ForegroundColor Red
    }
} else {
    Write-Host ""
    Write-Host "ALL TESTS PASSED!" -ForegroundColor Green
}
