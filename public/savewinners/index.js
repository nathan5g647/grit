const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

function getPeriodStart(period) {
  const now = new Date();
  if (period === 'week') {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }
  return new Date(2000, 0, 1);
}

exports.saveWeeklyWinners = functions.pubsub.schedule('every monday 00:00').timeZone('UTC').onRun(async (context) => {
  const usersSnap = await admin.firestore().collection('users').get();
  let topUser = null;
  let topScore = -1;

  for (const userDoc of usersSnap.docs) {
    const trainingsSnap = await admin.firestore()
      .collection('users').doc(userDoc.id)
      .collection('trainings').get();

    const trainings = trainingsSnap.docs.map(doc => doc.data());
    const periodStart = getPeriodStart('week');
    const score = trainings
      .filter(t => {
        const dateStr = t.date || t.createdAt;
        if (!dateStr) return false;
        const d = new Date(dateStr);
        return d >= periodStart;
      })
      .reduce((sum, t) => sum + (t.gritPoints || t.gritScore || t.grit || 0), 0);

    if (score > topScore) {
      topScore = score;
      topUser = { userId: userDoc.id, ...userDoc.data(), gritScore: score };
    }
  }

  if (topUser && topScore > 0) {
    await admin.firestore().collection('winners').doc('week').set({
      userId: topUser.userId,
      username: topUser.username || '',
      city: topUser.city || '',
      country: topUser.country || '',
      gritScore: topScore,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('Weekly winner saved:', topUser.userId);
  } else {
    console.log('No winner this week.');
  }
  return null;
});