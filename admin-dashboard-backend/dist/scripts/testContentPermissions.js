"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const crypto_1 = require("crypto");
const mongoose_1 = __importDefault(require("mongoose"));
const db_1 = require("../config/db");
const registry_1 = require("../models/registry");
const routes_1 = require("../routes");
async function request(baseUrl, path, token, options = {}) {
    return fetch(`${baseUrl}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            ...(options.headers || {}),
        },
    });
}
function expectStatus(label, actual, expected) {
    if (actual !== expected) {
        throw new Error(`${label}: expected ${expected}, received ${actual}.`);
    }
    console.log(`  PASS  ${label} -> ${actual}`);
}
/**
 * Phase 3 permission separation:
 * CONTENT_MANAGE grants create/edit/delete but must NOT grant publish/unpublish,
 * which requires CONTENT_PUBLISH. Also verifies content audit logging and that
 * audit entries are queryable through the generic /auditLogs endpoint using the
 * `limit` control param.
 */
async function testContentPermissionSeparation() {
    await (0, db_1.connectDB)();
    const suffix = (0, crypto_1.randomUUID)();
    const ids = {
        manageRole: `test_content_role_manage_${suffix}`,
        publishRole: `test_content_role_publish_${suffix}`,
        bothRole: `test_content_role_both_${suffix}`,
        deniedRole: `test_content_role_denied_${suffix}`,
        manageAdmin: `test_content_admin_manage_${suffix}`,
        publishAdmin: `test_content_admin_publish_${suffix}`,
        bothAdmin: `test_content_admin_both_${suffix}`,
        deniedAdmin: `test_content_admin_denied_${suffix}`,
        manageSession: `test_content_session_manage_${suffix}`,
        publishSession: `test_content_session_publish_${suffix}`,
        bothSession: `test_content_session_both_${suffix}`,
        deniedSession: `test_content_session_denied_${suffix}`,
    };
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    (0, routes_1.registerRoutes)(app);
    const server = await new Promise((resolve) => {
        const instance = app.listen(0, () => resolve(instance));
    });
    const address = server.address();
    if (!address || typeof address === 'string')
        throw new Error('Test server did not expose a port.');
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const now = new Date();
    let tipId = '';
    await registry_1.models.roles.create([
        { id: ids.manageRole, name: 'Content Test Manage', permissions: ['CONTENT_MANAGE'] },
        { id: ids.publishRole, name: 'Content Test Publish', permissions: ['CONTENT_PUBLISH'] },
        { id: ids.bothRole, name: 'Content Test Manage + Publish', permissions: ['CONTENT_MANAGE', 'CONTENT_PUBLISH'] },
        { id: ids.deniedRole, name: 'Content Test Denied', permissions: [] },
    ]);
    await registry_1.models.admins.create([
        { id: ids.manageAdmin, name: 'Content Test Manage Admin', email: `${ids.manageAdmin}@test.local`, password: 'test', roleId: ids.manageRole, status: 'active' },
        { id: ids.publishAdmin, name: 'Content Test Publish Admin', email: `${ids.publishAdmin}@test.local`, password: 'test', roleId: ids.publishRole, status: 'active' },
        { id: ids.bothAdmin, name: 'Content Test Both Admin', email: `${ids.bothAdmin}@test.local`, password: 'test', roleId: ids.bothRole, status: 'active' },
        { id: ids.deniedAdmin, name: 'Content Test Denied Admin', email: `${ids.deniedAdmin}@test.local`, password: 'test', roleId: ids.deniedRole, status: 'active' },
    ]);
    await registry_1.models.adminSessions.create([
        { id: ids.manageSession, adminId: ids.manageAdmin, token: ids.manageSession, createdAt: now, expiresAt: new Date(Date.now() + 60_000), revokedAt: null },
        { id: ids.publishSession, adminId: ids.publishAdmin, token: ids.publishSession, createdAt: now, expiresAt: new Date(Date.now() + 60_000), revokedAt: null },
        { id: ids.bothSession, adminId: ids.bothAdmin, token: ids.bothSession, createdAt: now, expiresAt: new Date(Date.now() + 60_000), revokedAt: null },
        { id: ids.deniedSession, adminId: ids.deniedAdmin, token: ids.deniedSession, createdAt: now, expiresAt: new Date(Date.now() + 60_000), revokedAt: null },
    ]);
    try {
        console.log('\n--- Admin with CONTENT_MANAGE only (no CONTENT_PUBLISH) ---');
        const createRes = await request(baseUrl, '/tips', ids.manageSession, {
            method: 'POST',
            body: JSON.stringify({ title: 'Content Permission Test Tip', body: 'Created by a CONTENT_MANAGE-only admin.', subtype: 'wellness' }),
        });
        expectStatus('POST /tips (create)', createRes.status, 201);
        const createdTip = (await createRes.json());
        tipId = createdTip.id;
        if (!tipId)
            throw new Error('Expected the created tip to expose an id.');
        const readRes = await request(baseUrl, `/tips/${tipId}`, ids.manageSession);
        expectStatus('GET /tips/:id (read)', readRes.status, 200);
        const editRes = await request(baseUrl, `/tips/${tipId}`, ids.manageSession, {
            method: 'PATCH',
            body: JSON.stringify({ title: 'Content Permission Test Tip (edited)', category: 'Wellness' }),
        });
        expectStatus('PATCH /tips/:id (edit)', editRes.status, 200);
        const editedTip = (await editRes.json());
        if (editedTip.title !== 'Content Permission Test Tip (edited)') {
            throw new Error(`Expected the edit to be applied, title is "${editedTip.title}".`);
        }
        const deniedPublish = await request(baseUrl, `/tips/${tipId}/publish`, ids.manageSession, { method: 'POST' });
        expectStatus('POST /tips/:id/publish (must be denied)', deniedPublish.status, 403);
        const deniedUnpublish = await request(baseUrl, `/tips/${tipId}/unpublish`, ids.manageSession, { method: 'POST' });
        expectStatus('POST /tips/:id/unpublish (must be denied)', deniedUnpublish.status, 403);
        const stillDraft = (await (await request(baseUrl, `/tips/${tipId}`, ids.manageSession)).json());
        if (stillDraft.status !== 'draft') {
            throw new Error(`Expected the tip to remain "draft" after denied publish, status is "${stillDraft.status}".`);
        }
        console.log(`  PASS  tip status unchanged after denied publish -> ${stillDraft.status}`);
        console.log('\n--- PATCH status guard (CONTENT_MANAGE must not set status) ---');
        const deniedStatusPatch = await request(baseUrl, `/tips/${tipId}`, ids.manageSession, {
            method: 'PATCH',
            body: JSON.stringify({ title: 'Status Guard Attempt', status: 'published' }),
        });
        expectStatus('PATCH /tips/:id with status (must be denied)', deniedStatusPatch.status, 403);
        const deniedStatusBody = (await deniedStatusPatch.json());
        if (!String(deniedStatusBody?.message || '').toLowerCase().includes('status')) {
            throw new Error(`Expected a status-specific 403 message, received "${deniedStatusBody?.message}".`);
        }
        const afterDeniedStatus = (await (await request(baseUrl, `/tips/${tipId}`, ids.manageSession)).json());
        if (afterDeniedStatus.status !== 'draft' || afterDeniedStatus.title === 'Status Guard Attempt') {
            throw new Error(`Expected the denied PATCH to change nothing (status="draft", old title), received status="${afterDeniedStatus.status}" title="${afterDeniedStatus.title}".`);
        }
        console.log('  PASS  PATCH with status rejected with 403 and left the document unchanged');
        const editWithoutStatus = await request(baseUrl, `/tips/${tipId}`, ids.manageSession, {
            method: 'PATCH',
            body: JSON.stringify({ category: 'Status Guard Category' }),
        });
        expectStatus('PATCH /tips/:id without status (CONTENT_MANAGE)', editWithoutStatus.status, 200);
        const editedWithoutStatus = (await editWithoutStatus.json());
        if (editedWithoutStatus.status !== 'draft' || editedWithoutStatus.category !== 'Status Guard Category') {
            throw new Error(`Expected the status-free PATCH to succeed without changing status, received status="${editedWithoutStatus.status}" category="${editedWithoutStatus.category}".`);
        }
        console.log('  PASS  PATCH without status succeeds normally');
        const bothStatusPatch = await request(baseUrl, `/tips/${tipId}`, ids.bothSession, {
            method: 'PATCH',
            body: JSON.stringify({ title: 'Content Permission Test Tip (status set by privileged admin)', status: 'published' }),
        });
        expectStatus('PATCH /tips/:id with status (CONTENT_MANAGE + CONTENT_PUBLISH)', bothStatusPatch.status, 200);
        const bothPatched = (await bothStatusPatch.json());
        if (bothPatched.status !== 'published') {
            throw new Error(`Expected a privileged admin to set status="published", received "${bothPatched.status}".`);
        }
        const republishRes = await request(baseUrl, `/tips/${tipId}/unpublish`, ids.publishSession, { method: 'POST' });
        expectStatus('POST /tips/:id/unpublish (reset before publish test)', republishRes.status, 200);
        console.log('\n--- Admin with CONTENT_PUBLISH only (no CONTENT_MANAGE) ---');
        const publishOnlyCreate = await request(baseUrl, '/tips', ids.publishSession, {
            method: 'POST',
            body: JSON.stringify({ title: 'Should Not Be Created', body: 'x', subtype: 'wellness' }),
        });
        expectStatus('POST /tips (must be denied)', publishOnlyCreate.status, 403);
        const publishOnlyEdit = await request(baseUrl, `/tips/${tipId}`, ids.publishSession, {
            method: 'PATCH',
            body: JSON.stringify({ title: 'Should Not Be Saved' }),
        });
        expectStatus('PATCH /tips/:id (must be denied)', publishOnlyEdit.status, 403);
        const publishOnlyDelete = await request(baseUrl, `/tips/${tipId}`, ids.publishSession, { method: 'DELETE' });
        expectStatus('DELETE /tips/:id (must be denied)', publishOnlyDelete.status, 403);
        const publishRes = await request(baseUrl, `/tips/${tipId}/publish`, ids.publishSession, { method: 'POST' });
        expectStatus('POST /tips/:id/publish (CONTENT_PUBLISH)', publishRes.status, 200);
        const publishedTip = (await publishRes.json());
        if (publishedTip.status !== 'published' || !publishedTip.publishedAt) {
            throw new Error(`Expected status "published" with publishedAt set, received "${publishedTip.status}".`);
        }
        console.log(`  PASS  published tip -> status=${publishedTip.status}`);
        const unpublishRes = await request(baseUrl, `/tips/${tipId}/unpublish`, ids.publishSession, { method: 'POST' });
        expectStatus('POST /tips/:id/unpublish (CONTENT_PUBLISH)', unpublishRes.status, 200);
        console.log('\n--- Admin with no content permissions ---');
        const deniedCreate = await request(baseUrl, '/tips', ids.deniedSession, {
            method: 'POST',
            body: JSON.stringify({ title: 'Denied Tip', body: 'x', subtype: 'wellness' }),
        });
        expectStatus('POST /tips (no permissions)', deniedCreate.status, 403);
        const deniedEdit = await request(baseUrl, `/tips/${tipId}`, ids.deniedSession, {
            method: 'PATCH',
            body: JSON.stringify({ title: 'Denied Edit' }),
        });
        expectStatus('PATCH /tips/:id (no permissions)', deniedEdit.status, 403);
        const deniedDelete = await request(baseUrl, `/tips/${tipId}`, ids.deniedSession, { method: 'DELETE' });
        expectStatus('DELETE /tips/:id (no permissions)', deniedDelete.status, 403);
        console.log('\n--- CONTENT_MANAGE-only admin deletes the tip ---');
        const deleteRes = await request(baseUrl, `/tips/${tipId}`, ids.manageSession, { method: 'DELETE' });
        expectStatus('DELETE /tips/:id (CONTENT_MANAGE)', deleteRes.status, 204);
        const afterDelete = await request(baseUrl, `/tips/${tipId}`, ids.manageSession);
        expectStatus('GET /tips/:id after delete', afterDelete.status, 404);
        console.log('\n--- Content audit logging ---');
        const auditLogs = await registry_1.models.auditLogs
            .find({ targetType: 'tips', targetId: tipId })
            .sort({ createdAt: 1 })
            .lean();
        const auditedActions = auditLogs.map((entry) => entry.action);
        console.log(`  audit entries written: ${auditedActions.join(', ') || '(none)'}`);
        for (const action of ['tips.created', 'tips.updated', 'tips.published', 'tips.unpublished', 'tips.deleted']) {
            if (!auditedActions.includes(action))
                throw new Error(`Expected an audit entry for ${action}.`);
        }
        for (const action of ['tips.published', 'tips.unpublished']) {
            const entry = auditLogs.find((log) => log.action === action);
            if (entry?.adminId !== ids.publishAdmin) {
                throw new Error(`Expected ${action} to be attributed to the CONTENT_PUBLISH admin.`);
            }
        }
        for (const action of ['tips.created', 'tips.updated', 'tips.deleted']) {
            const entry = auditLogs.find((log) => log.action === action);
            if (entry?.adminId !== ids.manageAdmin) {
                throw new Error(`Expected ${action} to be attributed to the CONTENT_MANAGE admin.`);
            }
        }
        console.log('  PASS  all five content actions audited with the correct acting admin');
        const auditApiRes = await request(baseUrl, `/auditLogs?targetType=tips&targetId=${tipId}&limit=10`, ids.manageSession);
        expectStatus('GET /auditLogs?targetType=tips&targetId=..&limit=10', auditApiRes.status, 200);
        const auditApiBody = (await auditApiRes.json());
        if (!Array.isArray(auditApiBody) || auditApiBody.length !== auditLogs.length) {
            throw new Error(`Expected the audit API to return ${auditLogs.length} entries, received ${Array.isArray(auditApiBody) ? auditApiBody.length : 'a non-array response'}.`);
        }
        console.log(`  PASS  audit API returned ${auditApiBody.length} entries (limit used as pagination, not a filter)`);
        console.log('\nContent permission separation test passed (CONTENT_MANAGE vs CONTENT_PUBLISH).');
    }
    finally {
        await Promise.all([
            registry_1.models.auditLogs.deleteMany({ targetType: 'tips', targetId: tipId }),
            registry_1.models.tips.deleteMany({ title: { $in: ['Content Permission Test Tip', 'Content Permission Test Tip (edited)', 'Content Permission Test Tip (status set by privileged admin)', 'Should Not Be Created', 'Denied Tip', 'Denied Edit', 'Should Not Be Saved', 'Status Guard Attempt'] } }),
            registry_1.models.adminSessions.deleteMany({ id: { $in: [ids.manageSession, ids.publishSession, ids.deniedSession] } }),
            registry_1.models.admins.deleteMany({ id: { $in: [ids.manageAdmin, ids.publishAdmin, ids.deniedAdmin] } }),
            registry_1.models.roles.deleteMany({ id: { $in: [ids.manageRole, ids.publishRole, ids.deniedRole] } }),
        ]);
        await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
        await mongoose_1.default.disconnect();
    }
}
testContentPermissionSeparation().catch((error) => {
    console.error('Content permission separation test failed:', error);
    process.exitCode = 1;
});
