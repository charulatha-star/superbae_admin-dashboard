import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { models, LooseDocument } from '../models/registry';
const now = new Date('2026-09-18T00:00:00Z');
const ts = (o: number): Date => new Date(now.getTime() + o * 1000);
const trackersData: LooseDocument[] = [
  { id: 'tracker_habit', trackerType: 'habit', name: 'Habit', description: 'General custom habits with progress bars', category: 'Wellness', isEnabled: true, sortOrder: 1, config: null, createdAt: ts(1), updatedAt: ts(1) },
  { id: 'tracker_mood', trackerType: 'mood', name: 'Mood', description: 'Daily mood logging with emoji scale', category: 'Wellness', isEnabled: true, sortOrder: 2, config: null, createdAt: ts(2), updatedAt: ts(2) },
  { id: 'tracker_water', trackerType: 'water', name: 'Water', description: 'Water intake against a daily goal, in litres/ml', category: 'Wellness', isEnabled: true, sortOrder: 3, config: { dailyGoal: '1L', goalMl: 1000 }, createdAt: ts(3), updatedAt: ts(3) },
  { id: 'tracker_sleep', trackerType: 'sleep', name: 'Sleep', description: 'Sleep/wake time logging with duration and quality', category: 'Wellness', isEnabled: true, sortOrder: 4, config: { fields: ['bedTime', 'wakeTime', 'duration', 'quality'] }, createdAt: ts(4), updatedAt: ts(4) },
  { id: 'tracker_expense', trackerType: 'expense', name: 'Expense', description: 'Income and expense logging with categories and accounts', category: 'Finance', isEnabled: true, sortOrder: 5, config: { modes: ['expense', 'income'] }, createdAt: ts(5), updatedAt: ts(5) },
  { id: 'tracker_sickness', trackerType: 'sickness', name: 'Sickness', description: 'Symptom and medication logging (illness log)', category: 'Health', isEnabled: true, sortOrder: 6, config: null, createdAt: ts(6), updatedAt: ts(6) },
  { id: 'tracker_measure', trackerType: 'measure', name: 'Measure', description: 'Body measurements', category: 'Health', isEnabled: true, sortOrder: 7, config: { fields: ['weight', 'bust', 'waist', 'height', 'hip', 'thighLeft', 'thighRight', 'armLeft', 'armRight'], unitSystem: 'metric' }, createdAt: ts(7), updatedAt: ts(7) },
  { id: 'tracker_period', trackerType: 'period', name: 'Period', description: 'Menstrual cycle tracking with day count, symptoms, flow', category: 'Health', isEnabled: true, sortOrder: 8, config: { fields: ['dayCount', 'symptoms', 'flow'] }, createdAt: ts(8), updatedAt: ts(8) },
  { id: 'tracker_intimacy', trackerType: 'intimacy', name: 'Intimacy', description: 'Intimacy logging with partner/self, protection status, mood', category: 'Wellness', isEnabled: true, sortOrder: 9, config: { fields: ['partner', 'protection', 'mood'] }, createdAt: ts(9), updatedAt: ts(9) },
  { id: 'tracker_bmi', trackerType: 'bmi', name: 'BMI', description: 'Weight/height BMI calculation with body insight breakdown', category: 'Health', isEnabled: true, sortOrder: 10, config: { inputs: ['weight', 'height'], unitSystem: 'metric' }, createdAt: ts(10), updatedAt: ts(10) },
];
const habitTemplatesData: LooseDocument[] = [
  { id: 'htpl_gym', trackerType: 'habit', label: 'Gym', sortOrder: 1, isActive: true, defaultTarget: null, defaultUnit: 'times', defaultRepeatCycle: 'weekly', createdAt: ts(11), updatedAt: ts(11) },
  { id: 'htpl_drink_water', trackerType: 'habit', label: 'Drink Water 5L', sortOrder: 2, isActive: true, defaultTarget: 5, defaultUnit: 'L', defaultRepeatCycle: 'daily', createdAt: ts(12), updatedAt: ts(12) },
  { id: 'htpl_run', trackerType: 'habit', label: 'Run 3KM', sortOrder: 3, isActive: true, defaultTarget: 3, defaultUnit: 'km', defaultRepeatCycle: 'daily', createdAt: ts(13), updatedAt: ts(13) },
  { id: 'htpl_protein', trackerType: 'habit', label: 'Eat protein 90g', sortOrder: 4, isActive: true, defaultTarget: 90, defaultUnit: 'g', defaultRepeatCycle: 'daily', createdAt: ts(14), updatedAt: ts(14) },
  { id: 'htpl_sleep', trackerType: 'habit', label: 'Sleep 8h', sortOrder: 5, isActive: true, defaultTarget: 8, defaultUnit: 'h', defaultRepeatCycle: 'daily', createdAt: ts(15), updatedAt: ts(15) },
  { id: 'htpl_steps', trackerType: 'habit', label: '10k Steps', sortOrder: 6, isActive: true, defaultTarget: 10000, defaultUnit: 'steps', defaultRepeatCycle: 'daily', createdAt: ts(16), updatedAt: ts(16) },
  { id: 'htpl_read', trackerType: 'habit', label: 'Read book', sortOrder: 7, isActive: true, defaultTarget: null, defaultUnit: 'times', defaultRepeatCycle: 'daily', createdAt: ts(17), updatedAt: ts(17) },
];
const moodOptionsData: LooseDocument[] = [
  { id: 'mood_happy', trackerType: 'mood', label: 'Happy', sortOrder: 1, isActive: true, emoji: '😊', createdAt: ts(21), updatedAt: ts(21) },
  { id: 'mood_loved', trackerType: 'mood', label: 'Loved', sortOrder: 2, isActive: true, emoji: '😍', createdAt: ts(22), updatedAt: ts(22) },
  { id: 'mood_excited', trackerType: 'mood', label: 'Excited', sortOrder: 3, isActive: true, emoji: '😃', createdAt: ts(23), updatedAt: ts(23) },
  { id: 'mood_neutral', trackerType: 'mood', label: 'Neutral', sortOrder: 4, isActive: true, emoji: '😐', createdAt: ts(24), updatedAt: ts(24) },
  { id: 'mood_sad', trackerType: 'mood', label: 'Sad', sortOrder: 5, isActive: true, emoji: '😢', createdAt: ts(25), updatedAt: ts(25) },
  { id: 'mood_anxious', trackerType: 'mood', label: 'Anxious', sortOrder: 6, isActive: true, emoji: '😟', createdAt: ts(26), updatedAt: ts(26) },
  { id: 'mood_tired', trackerType: 'mood', label: 'Tired', sortOrder: 7, isActive: true, emoji: '😴', createdAt: ts(27), updatedAt: ts(27) },
  { id: 'mood_angry', trackerType: 'mood', label: 'Angry', sortOrder: 8, isActive: true, emoji: '😠', createdAt: ts(28), updatedAt: ts(28) },
];
const symptomsData: LooseDocument[] = [
  { id: 'sym_fever', trackerType: 'sickness', label: 'Fever', sortOrder: 1, isActive: true, severityLevels: ['Low', 'Moderate', 'Extreme'], createdAt: ts(31), updatedAt: ts(31) },
  { id: 'sym_cough', trackerType: 'sickness', label: 'Cough', sortOrder: 2, isActive: true, severityLevels: ['Low', 'Moderate', 'Extreme'], createdAt: ts(32), updatedAt: ts(32) },
  { id: 'sym_breath', trackerType: 'sickness', label: 'Shortness of Breath', sortOrder: 3, isActive: true, severityLevels: ['Low', 'Moderate', 'Extreme'], createdAt: ts(33), updatedAt: ts(33) },
  { id: 'sym_fatigue', trackerType: 'sickness', label: 'Fatigue', sortOrder: 4, isActive: true, severityLevels: ['Low', 'Moderate', 'Extreme'], createdAt: ts(34), updatedAt: ts(34) },
  { id: 'sym_headache', trackerType: 'sickness', label: 'Headache', sortOrder: 5, isActive: true, severityLevels: ['Low', 'Moderate', 'Extreme'], createdAt: ts(35), updatedAt: ts(35) },
];
const periodSymptomsData: LooseDocument[] = [
  { id: 'psym_cramps', trackerType: 'period', label: 'Cramps', sortOrder: 1, isActive: true, severityLevels: ['Low', 'Moderate', 'Extreme'], createdAt: ts(41), updatedAt: ts(41) },
  { id: 'psym_bloating', trackerType: 'period', label: 'Bloating', sortOrder: 2, isActive: true, severityLevels: ['Low', 'Moderate', 'Extreme'], createdAt: ts(42), updatedAt: ts(42) },
  { id: 'psym_mood', trackerType: 'period', label: 'Mood swings', sortOrder: 3, isActive: true, severityLevels: ['Low', 'Moderate', 'Extreme'], createdAt: ts(43), updatedAt: ts(43) },
  { id: 'psym_headache', trackerType: 'period', label: 'Headache', sortOrder: 4, isActive: true, severityLevels: ['Low', 'Moderate', 'Extreme'], createdAt: ts(44), updatedAt: ts(44) },
  { id: 'psym_fatigue', trackerType: 'period', label: 'Fatigue', sortOrder: 5, isActive: true, severityLevels: ['Low', 'Moderate', 'Extreme'], createdAt: ts(45), updatedAt: ts(45) },
  { id: 'psym_breasts', trackerType: 'period', label: 'Tender breasts', sortOrder: 6, isActive: true, severityLevels: ['Low', 'Moderate', 'Extreme'], createdAt: ts(46), updatedAt: ts(46) },
  { id: 'psym_acne', trackerType: 'period', label: 'Acne', sortOrder: 7, isActive: true, severityLevels: ['Low', 'Moderate', 'Extreme'], createdAt: ts(47), updatedAt: ts(47) },
  { id: 'psym_back', trackerType: 'period', label: 'Back pain', sortOrder: 8, isActive: true, severityLevels: ['Low', 'Moderate', 'Extreme'], createdAt: ts(48), updatedAt: ts(48) },
];
const medicationsData: LooseDocument[] = [
  { id: 'med_paracetamol', trackerType: 'sickness', label: 'Paracetamol', sortOrder: 1, isActive: true, dosage: '650mg', createdAt: ts(51), updatedAt: ts(51) },
  { id: 'med_ibuprofen', trackerType: 'sickness', label: 'Ibuprofen', sortOrder: 2, isActive: true, dosage: '400mg', createdAt: ts(52), updatedAt: ts(52) },
  { id: 'med_amoxicillin', trackerType: 'sickness', label: 'Amoxicillin', sortOrder: 3, isActive: true, dosage: '500mg', createdAt: ts(53), updatedAt: ts(53) },
  { id: 'med_aspirin', trackerType: 'sickness', label: 'Aspirin', sortOrder: 4, isActive: true, dosage: '81mg', createdAt: ts(54), updatedAt: ts(54) },
  { id: 'med_cetirizine', trackerType: 'sickness', label: 'Cetirizine', sortOrder: 5, isActive: true, dosage: '10mg', createdAt: ts(55), updatedAt: ts(55) },
];
const expenseCategoriesData: LooseDocument[] = [
  { id: 'expc_food', trackerType: 'expense', label: 'Food & Dining', sortOrder: 1, isActive: true, expenseType: 'expense', createdAt: ts(61), updatedAt: ts(61) },
  { id: 'expc_transport', trackerType: 'expense', label: 'Transport', sortOrder: 2, isActive: true, expenseType: 'expense', createdAt: ts(62), updatedAt: ts(62) },
  { id: 'expc_entertainment', trackerType: 'expense', label: 'Entertainment', sortOrder: 3, isActive: true, expenseType: 'expense', createdAt: ts(63), updatedAt: ts(63) },
  { id: 'expc_utilities', trackerType: 'expense', label: 'Utilities', sortOrder: 4, isActive: true, expenseType: 'expense', createdAt: ts(64), updatedAt: ts(64) },
  { id: 'expc_health', trackerType: 'expense', label: 'Health & Fitness', sortOrder: 5, isActive: true, expenseType: 'expense', createdAt: ts(65), updatedAt: ts(65) },
  { id: 'expc_shopping', trackerType: 'expense', label: 'Shopping', sortOrder: 6, isActive: true, expenseType: 'expense', createdAt: ts(66), updatedAt: ts(66) },
  { id: 'expc_education', trackerType: 'expense', label: 'Education', sortOrder: 7, isActive: true, expenseType: 'expense', createdAt: ts(67), updatedAt: ts(67) },
  { id: 'expc_salary', trackerType: 'expense', label: 'Salary', sortOrder: 8, isActive: true, expenseType: 'income', createdAt: ts(68), updatedAt: ts(68) },
  { id: 'expc_freelance', trackerType: 'expense', label: 'Freelance', sortOrder: 9, isActive: true, expenseType: 'income', createdAt: ts(69), updatedAt: ts(69) },
  { id: 'expc_rental', trackerType: 'expense', label: 'Rental Income', sortOrder: 10, isActive: true, expenseType: 'income', createdAt: ts(70), updatedAt: ts(70) },
  { id: 'expc_investments', trackerType: 'expense', label: 'Investments', sortOrder: 11, isActive: true, expenseType: 'income', createdAt: ts(71), updatedAt: ts(71) },
  { id: 'expc_gifts', trackerType: 'expense', label: 'Gifts & Donations', sortOrder: 12, isActive: true, expenseType: 'income', createdAt: ts(72), updatedAt: ts(72) },
  { id: 'expc_bonuses', trackerType: 'expense', label: 'Bonuses', sortOrder: 13, isActive: true, expenseType: 'income', createdAt: ts(73), updatedAt: ts(73) },
  { id: 'expc_interest', trackerType: 'expense', label: 'Interest Income', sortOrder: 14, isActive: true, expenseType: 'income', createdAt: ts(74), updatedAt: ts(74) },
  { id: 'expc_overtime', trackerType: 'expense', label: 'Overtime Pay', sortOrder: 15, isActive: true, expenseType: 'income', createdAt: ts(75), updatedAt: ts(75) },
  { id: 'expc_benefits', trackerType: 'expense', label: 'Benefits', sortOrder: 16, isActive: true, expenseType: 'income', createdAt: ts(76), updatedAt: ts(76) },
];
const reminderTemplatesData: LooseDocument[] = [
  { id: 'rem_habit', trackerType: 'habit', defaultMessage: 'Time to work on your habit', defaultCadence: 'daily', enabledByDefault: false, createdAt: ts(81), updatedAt: ts(81) },
  { id: 'rem_mood', trackerType: 'mood', defaultMessage: 'How are you feeling today? Log your mood', defaultCadence: 'daily', enabledByDefault: false, createdAt: ts(82), updatedAt: ts(82) },
  { id: 'rem_water', trackerType: 'water', defaultMessage: 'Remind me to drink water', defaultCadence: 'daily', enabledByDefault: false, createdAt: ts(83), updatedAt: ts(83) },
  { id: 'rem_sleep', trackerType: 'sleep', defaultMessage: 'Time to wind down for sleep', defaultCadence: 'daily', enabledByDefault: false, createdAt: ts(84), updatedAt: ts(84) },
  { id: 'rem_expense', trackerType: 'expense', defaultMessage: 'Remember to log your expenses', defaultCadence: 'daily', enabledByDefault: false, createdAt: ts(85), updatedAt: ts(85) },
  { id: 'rem_sickness', trackerType: 'sickness', defaultMessage: 'Time to log your symptoms', defaultCadence: 'daily', enabledByDefault: false, createdAt: ts(86), updatedAt: ts(86) },
  { id: 'rem_measure', trackerType: 'measure', defaultMessage: 'Time to record your measurements', defaultCadence: 'weekly', enabledByDefault: false, createdAt: ts(87), updatedAt: ts(87) },
  { id: 'rem_period', trackerType: 'period', defaultMessage: 'Time to log your cycle', defaultCadence: 'daily', enabledByDefault: false, createdAt: ts(88), updatedAt: ts(88) },
  { id: 'rem_intimacy', trackerType: 'intimacy', defaultMessage: 'Time to update your intimacy log', defaultCadence: 'weekly', enabledByDefault: false, createdAt: ts(89), updatedAt: ts(89) },
  { id: 'rem_bmi', trackerType: 'bmi', defaultMessage: 'Time to check your BMI', defaultCadence: 'weekly', enabledByDefault: false, createdAt: ts(90), updatedAt: ts(90) },
];
const measurementUnitsData: LooseDocument = {
  unitSystem: 'metric',
  fields: [
    { field: 'weight', unit: 'KG' },
    { field: 'bust', unit: 'CM' },
    { field: 'waist', unit: 'CM' },
    { field: 'height', unit: 'CM' },
    { field: 'hip', unit: 'CM' },
    { field: 'thighLeft', unit: 'CM' },
    { field: 'thighRight', unit: 'CM' },
    { field: 'armLeft', unit: 'CM' },
    { field: 'armRight', unit: 'CM' },
  ],
};
const waterUnitsData: LooseDocument = {
  unitSystem: 'metric',
  presets: [
    { label: '500 ML', amountMl: 500 },
    { label: '750 ML', amountMl: 750 },
    { label: '1 L', amountMl: 1000 },
  ],
  customUnit: 'ml',
  customDefaultMl: 300,
  dailyGoalMl: 1000,
};
const collections: Array<{ name: string; model: mongoose.Model<LooseDocument>; data: LooseDocument[] }> = [
  { name: 'trackers', model: models.trackers, data: trackersData },
  { name: 'habitTemplates', model: models.habitTemplates, data: habitTemplatesData },
  { name: 'moodOptions', model: models.moodOptions, data: moodOptionsData },
  { name: 'symptoms', model: models.symptoms, data: symptomsData },
  { name: 'periodSymptoms', model: models.periodSymptoms, data: periodSymptomsData },
  { name: 'medications', model: models.medications, data: medicationsData },
  { name: 'expenseCategories', model: models.expenseCategories, data: expenseCategoriesData },
  { name: 'reminderTemplates', model: models.reminderTemplates, data: reminderTemplatesData },
];
async function seedTrackers(): Promise<void> {
  await connectDB();
  console.log('Seeding Tracker & Wellness configuration (idempotent, add-only)...');
  for (const { name, model, data } of collections) {
    const seedIds = data.map((d) => d.id);
    const existing = await model.find({ id: { $in: seedIds } }).lean<LooseDocument[]>();
    const existingIds = new Set(existing.map((d: LooseDocument) => d.id));
    const missing = data.filter((d) => !existingIds.has(d.id));
    if (missing.length === 0) {
      console.log(`${name}: ${data.length} already present, skipping.`);
    } else {
      let inserted = 0;
      for (const doc of missing) {
        try {
          await model.create(doc);
          inserted++;
        } catch (err: unknown) {
          if ((err as { code?: number })?.code === 11000) { inserted++; continue; }
          console.error(`  ERROR ${name}/${String(doc.id)}: ${(err as Error).message.substring(0, 120)}`);
        }
      }
      console.log(`${name}: inserted ${inserted} new docs (out of ${data.length} total).`);
    }
    console.log(`${name}: ${await model.countDocuments()} total docs.`);
  }
  const singletons: Array<{ name: 'measurementUnits' | 'waterUnits'; data: LooseDocument }> = [
    { name: 'measurementUnits', data: measurementUnitsData },
    { name: 'waterUnits', data: waterUnitsData },
  ];
  for (const { name, data } of singletons) {
    const model = models[name];
    const found = await model.findOne({ _singleton: name }).lean<LooseDocument | null>();
    if (found) {
      console.log(`${name}: singleton already present, skipping (no overwrite).`);
    } else {
      await model.create({ ...data, _singleton: name });
      console.log(`${name}: singleton created.`);
    }
  }
  console.log('=== Tracker seeding complete ===');
  await mongoose.disconnect();
}
seedTrackers().catch((error: unknown) => {
  console.error('Tracker seed failed:', error);
  process.exit(1);
});
