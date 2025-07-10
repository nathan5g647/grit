const functions = require('firebase-functions');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
admin.initializeApp();

const cors = require('cors')({ origin: true });

const fetch = global.fetch || ((...args) => import('node-fetch').then(({default: fetch}) => fetch(...args)));

exports.stravaTokenExchange = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        const code = req.query.code;
        if (!code) {
            return res.status(400).json({ error: 'Missing code' });
        }

        const client_id = '164917';
        const client_secret = 'b2f41f859d5860b1c8e0103b9b6a8667489c78d7';

        const params = new URLSearchParams({
            client_id,
            client_secret,
            code,
            grant_type: 'authorization_code'
        });

        try {
            const response = await fetch('https://www.strava.com/api/v3/oauth/token', {
                method: 'POST',
                body: params
            });
            const data = await response.json();
            if (response.ok) {
                res.json(data); // Frontend will save tokens
            } else {
                res.status(response.status).json({ error: 'Strava error', details: data });
            }
        } catch (err) {
            res.status(500).json({ error: 'Internal error', details: err.message });
        }
    });
});

// Scheduled function using v2 API
exports.saveWeeklyWinner = onSchedule(
  { schedule: '1 0 * * 1', timeZone: 'UTC' },
  async (event) => {
    const db = admin.firestore();
    const usersSnap = await db.collection('users').get();
    let winner = null;
    let maxGrit = -Infinity;
    usersSnap.forEach(doc => {
      const data = doc.data();
      if (data.weeklyGrit && data.weeklyGrit > maxGrit) {
        maxGrit = data.weeklyGrit;
        winner = { id: doc.id, ...data };
      }
    });
    if (winner) {
      await db.collection('winners').add({
        userId: winner.id,
        grit: winner.weeklyGrit,
        date: new Date().toISOString()
      });
    }
    console.log('Weekly winner saved:', winner ? winner.id : 'none');
    return null;
  }
);
