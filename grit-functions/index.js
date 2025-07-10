const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const cors = require('cors')({ origin: true });

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

// This function runs every Monday at 00:00 (midnight) UTC
exports.saveWeeklyWinner = functions.pubsub
    .schedule('1 0 * * 1') // Runs every Monday at 00:01 (12:01 AM) UTC
    .timeZone('UTC') // Change to your timezone if needed
    .onRun(async (context) => {
        // Your logic to determine and save the winner
        // Example:
        const db = admin.firestore();
        // Fetch users, calculate winner, and save to Firestore
        // (Replace this with your actual winner logic)
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
    });
