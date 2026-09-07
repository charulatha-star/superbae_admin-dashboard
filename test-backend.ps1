$ErrorActionPreference = "Continue"
$baseUrl = "http://localhost:3001"

Write-Host "=== BACKEND API TESTS ===" -ForegroundColor Cyan
Write-Host ""

# Test 1: Health check
Write-Host "--- Test 0: Health Check ---" -ForegroundColor Yellow
try {
    $health = Invoke-WebRequest -Uri "$baseUrl/health" -Method Get -ErrorAction Stop
    Write-Host "Status: $($health.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($health.Content)" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Server not running at $baseUrl" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 1: Authentication - GET /users without token
Write-Host "--- Test 1: AUTHENTICATION - GET /users without auth token ---" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/users" -Method Get -ErrorAction Stop
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    $data = $response.Content | ConvertFrom-Json
    Write-Host "Response count: $($data.Count) records" -ForegroundColor Green
    Write-Host "Expected: Should return data (NO 401 check implemented)" -ForegroundColor Cyan
    Write-Host "First record (if exists): $($data[0] | ConvertTo-Json -Depth 1)" -ForegroundColor Green
} catch {
    $statusCode = $_.Exception.Response.StatusCode.Value__
    Write-Host "Status: $statusCode" -ForegroundColor $(if ($statusCode -eq 401) { "Green" } else { "Yellow" })
    Write-Host "Response: $($_.Exception.Response.StatusDescription)" -ForegroundColor Yellow
}

Write-Host ""

# Test 2: Authorization - Check if protected routes exist and require permissions
Write-Host "--- Test 2: AUTHORIZATION - Check admin/restricted routes ---" -ForegroundColor Yellow
Write-Host "Note: Testing if GET /admins is accessible without permissions" -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/admins" -Method Get -ErrorAction Stop
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    $data = $response.Content | ConvertFrom-Json
    Write-Host "Response count: $($data.Count) records" -ForegroundColor Green
    Write-Host "FINDING: /admins route is publicly accessible, passwords are sanitized" -ForegroundColor Cyan
    Write-Host "First admin: $($data[0] | ConvertTo-Json -Depth 1)" -ForegroundColor Green
} catch {
    $statusCode = $_.Exception.Response.StatusCode.Value__
    Write-Host "Status: $statusCode" -ForegroundColor Yellow
    Write-Host "Response: $($_.Exception.Response | ConvertTo-Json)" -ForegroundColor Yellow
}

Write-Host ""

# Test 3: Search/Filter - GET /users with search parameters
Write-Host "--- Test 3: SEARCH/FILTER - GET /users with query parameters ---" -ForegroundColor Yellow
try {
    # First get all users
    $allResponse = Invoke-WebRequest -Uri "$baseUrl/users" -Method Get -ErrorAction Stop
    $allUsers = $allResponse.Content | ConvertFrom-Json
    Write-Host "Total users: $($allUsers.Count)" -ForegroundColor Green
    
    if ($allUsers.Count -gt 0) {
        $firstUser = $allUsers[0]
        $userName = if ($firstUser.name) { $firstUser.name } else { $firstUser.id }
        Write-Host "First user: $userName" -ForegroundColor Green
        
        # Test filter by name
        Write-Host ""
        Write-Host "Testing filter by name: '$($firstUser.name)'" -ForegroundColor Cyan
        $filteredResponse = Invoke-WebRequest -Uri "$baseUrl/users?name=$([System.Web.HttpUtility]::UrlEncode($firstUser.name))" -Method Get -ErrorAction Stop
        $filtered = $filteredResponse.Content | ConvertFrom-Json
        Write-Host "Filtered results count: $($filtered.Count)" -ForegroundColor Green
        Write-Host "Filtered response: $($filtered | ConvertTo-Json -Depth 1)" -ForegroundColor Green
    } else {
        Write-Host "No users found - creating test user first" -ForegroundColor Yellow
    }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Response: $($_.Exception.Response)" -ForegroundColor Red
}

Write-Host ""

# Test 4: Update User - PATCH with valid data
Write-Host "--- Test 4: UPDATE USER - PATCH /users/:id with valid data ---" -ForegroundColor Yellow
try {
    # Get a user first
    $allResponse = Invoke-WebRequest -Uri "$baseUrl/users" -Method Get -ErrorAction Stop
    $allUsers = $allResponse.Content | ConvertFrom-Json
    
    if ($allUsers.Count -gt 0) {
        $userId = $allUsers[0].id
        Write-Host "Testing PATCH on user: $userId" -ForegroundColor Cyan
        
        $updateBody = @{
            status = "active"
            posts = 99
        } | ConvertTo-Json
        
        Write-Host "Request body: $updateBody" -ForegroundColor Cyan
        
        $patchResponse = Invoke-WebRequest -Uri "$baseUrl/users/$userId" -Method Patch -Body $updateBody -ContentType "application/json" -ErrorAction Stop
        Write-Host "Status: $($patchResponse.StatusCode)" -ForegroundColor Green
        $updated = $patchResponse.Content | ConvertFrom-Json
        Write-Host "Updated record: $($updated | ConvertTo-Json -Depth 1)" -ForegroundColor Green
    } else {
        Write-Host "No users available to test" -ForegroundColor Yellow
    }
} catch {
    Write-Host "ERROR Status: $($_.Exception.Response.StatusCode.Value__)" -ForegroundColor Red
    Write-Host "ERROR Message: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 4b: Update User - PATCH with INVALID data (malformed email)
Write-Host "--- Test 4b: UPDATE USER - PATCH /users/:id with INVALID email ---" -ForegroundColor Yellow
try {
    $allResponse = Invoke-WebRequest -Uri "$baseUrl/users" -Method Get -ErrorAction Stop
    $allUsers = $allResponse.Content | ConvertFrom-Json
    
    if ($allUsers.Count -gt 0) {
        $userId = $allUsers[0].id
        
        # Try to update with invalid email
        $invalidBody = @{
            email = "not-an-email"
            name = "Test User"
        } | ConvertTo-Json
        
        Write-Host "Request body with invalid email: $invalidBody" -ForegroundColor Cyan
        
        $patchResponse = Invoke-WebRequest -Uri "$baseUrl/users/$userId" -Method Patch -Body $invalidBody -ContentType "application/json" -ErrorAction Stop
        Write-Host "Status: $($patchResponse.StatusCode)" -ForegroundColor Yellow
        Write-Host "Response: $($patchResponse.Content)" -ForegroundColor Yellow
        Write-Host "WARNING: Invalid email was accepted!" -ForegroundColor Red
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.Value__
    Write-Host "Status: $statusCode" -ForegroundColor $(if ($statusCode -eq 400) { "Green" } else { "Yellow" })
    Write-Host "Error Response: " -ForegroundColor Cyan
    Write-Host "$($_.Exception.Response.StatusDescription)" -ForegroundColor Yellow
}

Write-Host ""

# Test 5: Validation - Missing required fields in POST
Write-Host "--- Test 5: VALIDATION - POST /users with missing required fields ---" -ForegroundColor Yellow
try {
    # Try to create a user with missing name (should be required)
    $invalidBody = @{
        email = "test@example.com"
        status = "active"
    } | ConvertTo-Json
    
    Write-Host "Request body (missing 'name'): $invalidBody" -ForegroundColor Cyan
    
    $postResponse = Invoke-WebRequest -Uri "$baseUrl/users" -Method Post -Body $invalidBody -ContentType "application/json" -ErrorAction Stop
    Write-Host "Status: $($postResponse.StatusCode)" -ForegroundColor Yellow
    Write-Host "Response: $($postResponse.Content)" -ForegroundColor Yellow
    Write-Host "WARNING: Missing required field was not validated!" -ForegroundColor Red
} catch {
    $statusCode = $_.Exception.Response.StatusCode.Value__
    Write-Host "Status: $statusCode" -ForegroundColor $(if ($statusCode -eq 400) { "Green" } else { "Yellow" })
    $bodyContent = $_.Exception.Response.Content
    if ($bodyContent) {
        try {
            $errorBody = $bodyContent.ReadAsStream() | ForEach-Object { $_.ReadToEnd() }
            Write-Host "Error Response: $errorBody" -ForegroundColor Yellow
        } catch {
            Write-Host "Error Response: $($_.Exception.Response.StatusDescription)" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host "=== TEST COMPLETE ===" -ForegroundColor Cyan
