const functions = require('firebase-functions');

const cors = require('cors')({ origin: true });

exports.stravaTokenExchange = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        const code = req.query.code;
        if (!code) {
            return res.status(400).json({ error: 'Missing code' });
        }

        const client_id = '164917';
        const client_secret = 'b2f41f859d5860b1c8e0103b9b6a8667489c78d7'; // Make sure this is correct!

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
                res.json(data);
            } else {
                // Send the Strava error directly to the browser!
                res.status(response.status).json({ error: 'Strava error', details: data });
            }
        } catch (err) {
            res.status(500).json({ error: 'Internal error', details: err.message });
        }
    });
});
