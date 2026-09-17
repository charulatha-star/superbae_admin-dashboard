"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
async function fetchApi(endpoint, options = {}) {
    const response = await fetch(`http://localhost:3001${endpoint}`, {
        // The merged headers must come AFTER spreading options: callers pass an
        // Authorization-only header object, which used to overwrite the
        // Content-Type header so express.json() left req.body undefined and every
        // create/update in this script returned 400.
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });
    const text = await response.text();
    let data;
    try {
        data = JSON.parse(text);
    }
    catch {
        data = text;
    }
    return { status: response.status, data };
}
async function login() {
    const { status, data } = await fetchApi('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'superadmin@example.com', password: 'superadmin@123' }),
    });
    if (status !== 200)
        throw new Error(`Login failed: ${status} ${JSON.stringify(data)}`);
    return data.token;
}
async function test() {
    console.log('=== CMS Phase 3 Permission Tests ===\n');
    const token = await login();
    console.log('Logged in as superadmin\n');
    const authHeaders = { 'Authorization': `Bearer ${token}` };
    // Test 1: GET endpoints still work (read-only)
    console.log('--- Test 1: GET endpoints (read access) ---');
    for (const resource of ['tips', 'affirmations', 'banners', 'zodiac', 'journalPrompts', 'fortuneCookies', 'communityGuidelines', 'appAnnouncements', 'events']) {
        const { status, data } = await fetchApi(`/${resource}`, { headers: authHeaders });
        const count = Array.isArray(data) ? data.length : 'N/A';
        console.log(`GET /${resource}: ${status} (${count} docs)`);
    }
    console.log();
    // Test 2: POST /affirmations without CONTENT_MANAGE - should fail
    // (superadmin has it, so we'll test with a role that doesn't have it)
    // For now, test with superadmin who has the permission
    console.log('--- Test 2: Create with CONTENT_MANAGE (superadmin) ---');
    const createAffirmation = {
        text: 'Test affirmation for permission check',
        category: 'Test',
        status: 'draft',
    };
    const { status: createStatus, data: createData } = await fetchApi('/affirmations', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(createAffirmation),
    });
    console.log(`POST /affirmations: ${createStatus}`);
    if (createStatus === 201) {
        console.log(`  Created: ${createData.id}`);
        var testAffirmationId = createData.id;
    }
    else {
        console.log(`  Error: ${JSON.stringify(createData)}`);
    }
    console.log();
    // Test 3: Required field validation
    console.log('--- Test 3: Required field validation ---');
    const { status: valStatus, data: valData } = await fetchApi('/affirmations', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ category: 'Test', status: 'draft' }), // missing required 'text'
    });
    console.log(`POST /affirmations (missing text): ${valStatus}`);
    console.log(`  Error: ${JSON.stringify(valData)}`);
    console.log();
    // Test 4: Tips subtype validation
    console.log('--- Test 4: Tips subtype validation ---');
    const { status: tipValStatus, data: tipValData } = await fetchApi('/tips', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ title: 'Test', body: 'Test body', subtype: 'invalid' }), // invalid subtype
    });
    console.log(`POST /tips (invalid subtype): ${tipValStatus}`);
    console.log(`  Error: ${JSON.stringify(tipValData)}`);
    console.log();
    // Test 5: Valid tips creation
    console.log('--- Test 5: Valid tips creation ---');
    const { status: tipStatus, data: tipData } = await fetchApi('/tips', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ title: 'Test Tip', body: 'Test body', subtype: 'wellness' }),
    });
    console.log(`POST /tips (valid): ${tipStatus}`);
    if (tipStatus === 201) {
        console.log(`  Created: ${tipData.id}`);
        var testTipId = tipData.id;
    }
    console.log();
    // Test 6: PATCH /affirmations/:id (edit)
    if (testAffirmationId) {
        console.log('--- Test 6: Edit (PATCH) with CONTENT_MANAGE ---');
        const { status: patchStatus, data: patchData } = await fetchApi(`/affirmations/${testAffirmationId}`, {
            method: 'PATCH',
            headers: authHeaders,
            body: JSON.stringify({ text: 'Updated affirmation text', category: 'Updated' }),
        });
        console.log(`PATCH /affirmations/${testAffirmationId}: ${patchStatus}`);
        if (patchStatus === 200)
            console.log(`  Updated: ${patchData.text}`);
        console.log();
    }
    // Test 7: Publish requires CONTENT_PUBLISH (separate from CONTENT_MANAGE)
    if (testTipId) {
        console.log('--- Test 7: Publish with CONTENT_PUBLISH ---');
        const { status: pubStatus, data: pubData } = await fetchApi(`/tips/${testTipId}/publish`, {
            method: 'POST',
            headers: authHeaders,
        });
        console.log(`POST /tips/${testTipId}/publish: ${pubStatus}`);
        if (pubStatus === 200) {
            console.log(`  Status: ${pubData.status}, publishedAt: ${pubData.publishedAt}`);
        }
        console.log();
    }
    // Test 8: Unpublish
    if (testTipId) {
        console.log('--- Test 8: Unpublish (sets to archived) ---');
        const { status: unpubStatus, data: unpubData } = await fetchApi(`/tips/${testTipId}/unpublish`, {
            method: 'POST',
            headers: authHeaders,
        });
        console.log(`POST /tips/${testTipId}/unpublish: ${unpubStatus}`);
        if (unpubStatus === 200) {
            console.log(`  Status: ${unpubData.status}`);
        }
        console.log();
    }
    // Test 9: Delete with CONTENT_MANAGE
    if (testAffirmationId) {
        console.log('--- Test 9: Delete with CONTENT_MANAGE ---');
        const { status: delStatus, data: delData } = await fetchApi(`/affirmations/${testAffirmationId}`, {
            method: 'DELETE',
            headers: authHeaders,
        });
        console.log(`DELETE /affirmations/${testAffirmationId}: ${delStatus}`);
        console.log();
    }
    // Test 10: Audit log entries
    // NOTE: the `limit` query param is a control param, not a filter — it used to
    // be forwarded to Mongo as a document filter which made this query silently
    // return nothing. Kept as an explicit regression check.
    console.log('--- Test 10: Audit log entries ---');
    const { status: auditStatus, data: auditData } = await fetchApi('/auditLogs?targetType=tips&limit=5', {
        headers: authHeaders,
    });
    console.log(`GET /auditLogs (tips): ${auditStatus}`);
    const auditEntries = Array.isArray(auditData) ? auditData : [];
    if (auditEntries.length === 0) {
        throw new Error('Expected content audit entries for targetType=tips, received none.');
    }
    for (const entry of auditEntries) {
        console.log(`  ${entry.action} - ${entry.targetType} ${entry.targetId} - ${entry.description}`);
        if (entry.targetType !== 'tips')
            throw new Error(`Expected targetType "tips", received "${entry.targetType}".`);
        if (!entry.targetId)
            throw new Error('Expected every content audit entry to carry a targetId.');
    }
    console.log();
    // Test 10b: Audit entries can be filtered by the content id
    if (testTipId) {
        console.log('--- Test 10b: Audit entries for the tip created in Test 5 ---');
        const { status: tipAuditStatus, data: tipAuditData } = await fetchApi(`/auditLogs?targetType=tips&targetId=${testTipId}&limit=10`, { headers: authHeaders });
        const tipAuditEntries = Array.isArray(tipAuditData) ? tipAuditData : [];
        console.log(`GET /auditLogs?targetType=tips&targetId=${testTipId}: ${tipAuditStatus} (${tipAuditEntries.length} entries)`);
        if (tipAuditEntries.length === 0) {
            throw new Error(`Expected audit entries for tip ${testTipId}, received none.`);
        }
        const expectedActions = ['tips.created', 'tips.published', 'tips.unpublished'];
        for (const action of expectedActions) {
            const found = tipAuditEntries.some((entry) => entry.action === action);
            if (!found)
                throw new Error(`Expected audit entry ${action} for tip ${testTipId}.`);
            console.log(`  ${action}: FOUND`);
        }
        console.log(`  all recorded actions: ${tipAuditEntries.map((entry) => entry.action).join(', ')}`);
        console.log();
    }
    // Test 11: Events regression
    console.log('--- Test 11: Events regression ---');
    const { status: evtStatus, data: evtData } = await fetchApi('/events', { headers: authHeaders });
    console.log(`GET /events: ${evtStatus} (${Array.isArray(evtData) ? evtData.length : 'N/A'} docs)`);
    console.log();
    console.log('=== All tests completed ===');
}
test().catch(e => console.error('Test failed:', e));
