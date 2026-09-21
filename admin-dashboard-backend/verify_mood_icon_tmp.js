require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const moods = db.collection('moodOptions');
  console.log('MOODS_TOTAL=' + (await moods.countDocuments({})));
  console.log('MOODS_WITH_ICON=' + (await moods.countDocuments({ icon: { $exists: true } })));
  console.log('MOODS_WITH_EMOJI=' + (await moods.countDocuments({ emoji: { $exists: true } })));

  const rows = await moods
    .find({}, { projection: { _id: 0, id: 1, label: 1, emoji: 1, icon: 1, sortOrder: 1, isActive: 1 } })
    .sort({ sortOrder: 1 })
    .toArray();

  rows.forEach((r) => {
    const codes = r.emoji
      ? [...r.emoji].map((c) => c.codePointAt(0).toString(16)).join('+')
      : 'NONE';
    console.log(
      'MOOD label=' + r.label +
      ' emoji_codepoints=' + codes +
      ' icon_present=' + Object.prototype.hasOwnProperty.call(r, 'icon') +
      ' sortOrder=' + r.sortOrder +
      ' isActive=' + r.isActive
    );
  });

  for (const name of ['habitTemplates', 'symptoms', 'periodSymptoms', 'medications', 'expenseCategories']) {
    const c = db.collection(name);
    console.log(
      'OTHER ' + name +
      ' total=' + (await c.countDocuments({})) +
      ' with_icon_field=' + (await c.countDocuments({ icon: { $exists: true } }))
    );
  }

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
