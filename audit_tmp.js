require('dotenv').config();
const mongoose = require('mongoose');
(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const cols = ['trackers','habitTemplates','moodOptions','symptoms','periodSymptoms','medications','expenseCategories','reminderTemplates','measurementUnits','waterUnits','auditLogs','permissions','roles'];
    for (const c of cols) {
      try { const n = await db.collection(c).countDocuments(); console.log(c + ':' + n); }
      catch (e) { console.log(c + ':ERR ' + e.message); }
    }
    const tr = await db.collection('trackers').find({}, {projection:{trackerType:1,name:1,id:1,_id:0}}).toArray();
    console.log('TRACKERS:' + JSON.stringify(tr));
    const dup = await db.collection('trackers').aggregate([{$group:{_id:'$trackerType',n:{$sum:1}}},{$match:{n:{$gt:1}}}]).toArray();
    console.log('DUP_TYPES:' + JSON.stringify(dup));
    const mal = await db.collection('trackers').find({trackerType:{$exists:false}}).limit(5).toArray();
    console.log('MALFORMED:' + mal.length);
    const one = await db.collection('trackers').findOne();
    console.log('TRACKER_KEYS:' + Object.keys(one || {}).sort().join(','));
    const optCols = ['habitTemplates','moodOptions','symptoms','periodSymptoms','medications','expenseCategories'];
    for (const c of optCols) {
      const d = await db.collection(c).findOne();
      console.log(c + '_KEYS:' + Object.keys(d || {}).sort().join(','));
    }
    const rt = await db.collection('reminderTemplates').findOne();
    console.log('REMINDER_KEYS:' + Object.keys(rt || {}).sort().join(','));
    const moods = await db.collection('moodOptions').find({}, {projection:{label:1,_id:0}}).toArray();
    console.log('MOODS:' + moods.map(x=>x.label).join('|'));
    const sym = await db.collection('symptoms').find({}, {projection:{label:1,_id:0}}).toArray();
    console.log('SYM:' + sym.map(x=>x.label).join('|'));
    const psy = await db.collection('periodSymptoms').find({}, {projection:{label:1,_id:0}}).toArray();
    console.log('PSYM:' + psy.map(x=>x.label).join('|'));
    const med = await db.collection('medications').find({}, {projection:{label:1,dosage:1,_id:0}}).toArray();
    console.log('MEDS:' + med.map(x=>x.label+' '+x.dosage).join('|'));
    const ex = await db.collection('expenseCategories').aggregate([{$group:{_id:'$expenseType',n:{$sum:1}}}]).toArray();
    console.log('EXP_TYPES:' + JSON.stringify(ex));
    const exLabels = await db.collection('expenseCategories').find({}, {projection:{label:1,expenseType:1,_id:0}}).toArray();
    console.log('EXP_LABELS:' + exLabels.map(x=>x.label+'['+x.expenseType+']').join('|'));
    const mu = await db.collection('measurementUnits').find().toArray();
    console.log('MU_N:' + mu.length + ' KEYS:' + Object.keys(mu[0]||{}).sort().join(','));
    const wu = await db.collection('waterUnits').find().toArray();
    console.log('WU_N:' + wu.length + ' KEYS:' + Object.keys(wu[0]||{}).sort().join(','));
    const perm = await db.collection('permissions').find({id:'TRACKER_CONFIG_MANAGE'}).toArray();
    console.log('PERM_TRACKER:' + JSON.stringify(perm.map(p=>({id:p.id,module:p.module,resource:p.resource,action:p.action}))));
    const roles = await db.collection('roles').find({}).toArray();
    console.log('ROLES:' + roles.map(r=>r.id+':'+JSON.stringify(r.permissions)).join(' || '));
    const audits = await db.collection('auditLogs').find({targetType:{$in:['trackers','habitTemplates','moodOptions','symptoms','periodSymptoms','medications','expenseCategories','reminderTemplates','measurementUnits','waterUnits']}}).sort({createdAt:-1}).limit(10).toArray();
    console.log('AUDIT_N:' + audits.length);
    for (const a of audits) console.log('AUDIT:' + JSON.stringify({action:a.action,targetType:a.targetType,targetId:a.targetId,createdAt:a.createdAt}));
    const audits2 = await db.collection('auditLogs').find({action:{$regex:'tracker', $options:'i'}}).sort({createdAt:-1}).limit(10).toArray();
    console.log('AUDIT2_N:' + audits2.length);
    for (const a of audits2) console.log('AUDIT2:' + JSON.stringify({action:a.action,targetType:a.targetType,targetId:a.targetId,createdAt:a.createdAt}));
  } catch (e) { console.error('ERR', e.message); }
  finally { await mongoose.disconnect(); }
})();
