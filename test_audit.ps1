$loginBody = @{ email = "superadmin@example.com"; password = "superadmin@123" } | ConvertTo-Json;
$loginResp = Invoke-WebRequest -Uri "http://localhost:3001/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -UseBasicParsing;
$token = ($loginResp.Content | ConvertFrom-Json).token;
$headers = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" };

Write-Host "=== Audit Log Verification Test ===";
Write-Host "";

Write-Host "--- 1. CREATE tip ---";
$body = @{ title = "Audit Test Tip"; body = "Test body for audit"; subtype = "wellness" } | ConvertTo-Json;
$resp = Invoke-WebRequest -Uri "http://localhost:3001/tips" -Method Post -Body $body -Headers $headers -UseBasicParsing;
$tip = $resp.Content | ConvertFrom-Json;
Write-Host ("POST /tips: {0}" -f $resp.StatusCode);
Write-Host ("Created: {0}" -f $tip.id);
$tipId = $tip.id;

Write-Host "";
Write-Host "--- 2. UPDATE tip (PATCH) ---";
$body = @{ title = "Audit Test Tip Updated" } | ConvertTo-Json;
$resp = Invoke-WebRequest -Uri ("http://localhost:3001/tips/{0}" -f $tipId) -Method Patch -Body $body -Headers $headers -UseBasicParsing;
Write-Host ("PATCH /tips/{0}: {1}" -f $tipId, $resp.StatusCode);

Write-Host "";
Write-Host "--- 3. PUBLISH tip ---";
$resp = Invoke-WebRequest -Uri ("http://localhost:3001/tips/{0}/publish" -f $tipId) -Method Post -Headers $headers -UseBasicParsing;
Write-Host ("POST /tips/{0}/publish: {1}" -f $tipId, $resp.StatusCode);
$pub = $resp.Content | ConvertFrom-Json;
Write-Host ("Status: {0}" -f $pub.status);

Write-Host "";
Write-Host "--- 4. UNPUBLISH tip ---";
$resp = Invoke-WebRequest -Uri ("http://localhost:3001/tips/{0}/unpublish" -f $tipId) -Method Post -Headers $headers -UseBasicParsing;
Write-Host ("POST /tips/{0}/unpublish: {1}" -f $tipId, $resp.StatusCode);
$unpub = $resp.Content | ConvertFrom-Json;
Write-Host ("Status: {0}" -f $unpub.status);

Write-Host "";
Write-Host "--- 5. DELETE tip ---";
$resp = Invoke-WebRequest -Uri ("http://localhost:3001/tips/{0}" -f $tipId) -Method Delete -Headers $headers -UseBasicParsing;
Write-Host ("DELETE /tips/{0}: {1}" -f $tipId, $resp.StatusCode);

Write-Host "";
Write-Host "=== Query audit logs for this tip ===";
$resp = Invoke-WebRequest -Uri ("http://localhost:3001/auditLogs?targetType=tips&targetId={0}&limit=10" -f $tipId) -Headers $headers -UseBasicParsing;
$data = $resp.Content | ConvertFrom-Json;
Write-Host ("GET /auditLogs (targetId={0}): {1} entries" -f $tipId, $data.Count);
$data | ForEach-Object { 
    Write-Host ("  {0} - action: {1} - target: {2} - {3}" -f $_.createdAt, $_.action, $_.targetId, $_.description); 
};

Write-Host "";
Write-Host "=== Verify all 5 actions present ===";
$actions = $data | ForEach-Object { $_.action };
$expected = @("tips.created", "tips.updated", "tips.published", "tips.unpublished", "tips.deleted");
$allFound = $true;
foreach ($exp in $expected) {
    $found = $actions -contains $exp;
    $status = if ($found) { "FOUND" } else { "MISSING" };
    Write-Host ("  {0}: {1}" -f $exp, $status);
    if (-not $found) { $allFound = $false }
}
Write-Host "";
if ($allFound) {
    Write-Host "✅ ALL 5 AUDIT ACTIONS LOGGED CORRECTLY";
} else {
    Write-Host "❌ SOME AUDIT ACTIONS MISSING";
}