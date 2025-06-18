import { doc, setDoc, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import { auth, db } from './script.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

const form = document.getElementById('settingsForm');
const logoutBtn = document.getElementById('logoutBtn');
const originalFormHTML = form.innerHTML;

// Fill form fields from Firestore data
function fillForm(data) {
    if (document.getElementById('username')) document.getElementById('username').value = data.username || '';
    if (document.getElementById('sex')) document.getElementById('sex').value = data.sex || '';
    if (document.getElementById('dob')) document.getElementById('dob').value = data.dob || '';
    if (document.getElementById('city')) document.getElementById('city').value = data.city || '';
    if (document.getElementById('height')) document.getElementById('height').value = data.height || '';
    if (document.getElementById('weight')) document.getElementById('weight').value = data.weight || '';
    if (document.getElementById('maxHr')) document.getElementById('maxHr').value = data.maxHr || '';
    if (document.getElementById('restHr')) document.getElementById('restHr').value = data.restHr || '';
    const usernameInput = document.getElementById('username');
    if (usernameInput) usernameInput.readOnly = true;
}

// Show summary view
function displaySettingsAsText(data) {
    form.innerHTML = `
        <label>Username:</label> <span>${data.username || '<span style="color:#888;">(not set)</span>'}</span><br>
        <label>Sex:</label> <span>${data.sex || ''}</span><br>
        <label>Date of Birth:</label> <span>${data.dob || ''}</span><br>
        <label>City:</label> <span>${data.city || ''}</span><br>
        <label>Height (cm):</label> <span>${data.height || ''}</span><br>
        <label>Weight (kg):</label> <span>${data.weight || ''}</span><br>
        <label>Max HR:</label> <span>${data.maxHr || ''}</span><br>
        <label>Rest HR:</label> <span>${data.restHr || ''}</span><br>
        <div id="stravaStatus" style="text-align:center; margin: 24px 0 12px 0;"></div>
        <div id="stravaConnectContainer" style="text-align:center; margin-bottom: 24px;"></div>
        <button id="editSettings" type="button">Edit Settings</button>
    `;
    updateStravaStatus();
    const editBtn = document.getElementById('editSettings');
    if (editBtn) {
        editBtn.onclick = function() {
            form.innerHTML = originalFormHTML;
            fillForm(data); // always fill with all data, including username
            updateStravaStatus();
        };
    }
}

// Save settings (never save username, never delete other fields)
form.onsubmit = async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    // Fetch the current settings to merge
    const docRef = doc(db, "users", user.uid, "settings", "profile");
    const docSnap = await getDoc(docRef);
    let currentData = {};
    if (docSnap.exists()) {
        currentData = docSnap.data();
    }

    // Only update editable fields
    const updatedData = {
        sex: document.getElementById('sex')?.value || currentData.sex || '',
        dob: document.getElementById('dob')?.value || currentData.dob || '',
        city: document.getElementById('city')?.value || currentData.city || '',
        height: document.getElementById('height')?.value || currentData.height || '',
        weight: document.getElementById('weight')?.value || currentData.weight || '',
        maxHr: document.getElementById('maxHr')?.value || currentData.maxHr || '',
        restHr: document.getElementById('restHr')?.value || currentData.restHr || ''
    };

    // Merge with ALL existing data, not just editable fields
    const mergedData = { ...currentData, ...updatedData };

    await setDoc(docRef, mergedData, { merge: true });
    displaySettingsAsText(mergedData);
};

// Show/hide logout button
onAuthStateChanged(auth, async (user) => {
    if (logoutBtn) logoutBtn.style.display = user ? 'inline-block' : 'none';
    if (!user) return;

    // Only handle Strava connection if ?code=... is present
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    // Handle Strava OAuth code ONLY
    if (code) {
        fetch('https://us-central1-grit-802e6.cloudfunctions.net/stravaTokenExchange?code=' + code)
            .then(res => res.json())
            .then(async data => {
                if (data.access_token) {
                    await setDoc(doc(db, "users", user.uid, "strava", "connection"), {
                        connected: true,
                        accessToken: data.access_token,
                        refreshToken: data.refresh_token, // <-- ADD THIS
                        expiresAt: data.expires_at,       // <-- ADD THIS
                        connectedAt: new Date().toISOString()
                    });
                    window.location.href = window.location.pathname; // Clean up URL
                } else {
                    alert('Failed to connect to Strava: ' + JSON.stringify(data));
                }
            })
            .catch(err => {
                alert('Failed to connect to Strava (network): ' + err);
            });
        return; // STOP: Do not render or save settings here!
    }

    // Normal settings rendering (only if not handling Strava code)
    const docRef = doc(db, "users", user.uid, "settings", "profile");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const data = docSnap.data();
        displaySettingsAsText(data);
    } else {
        fillForm({});
        updateStravaStatus();
    }
});

// Logout logic
if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
        auth.signOut().then(function() {
            window.location.href = "index.html";
        });
    });
}

// Strava status and connect button
async function updateStravaStatus() {
    const statusDiv = document.getElementById('stravaStatus');
    const btnContainer = document.getElementById('stravaConnectContainer');
    if (!statusDiv) return;

    // Clear button container
    if (btnContainer) btnContainer.innerHTML = '';

    const user = auth.currentUser;
    if (!user) {
        statusDiv.textContent = "Strava not connected";
        statusDiv.style.color = "#888";
        return;
    }

    const stravaDocRef = doc(db, "users", user.uid, "strava", "connection");
    const stravaDoc = await getDoc(stravaDocRef);
    if (stravaDoc.exists() && stravaDoc.data().connected) {
        statusDiv.textContent = "Strava connected";
        statusDiv.style.color = "#fc4c02";
        // Show disconnect button below status
        if (btnContainer) {
            const disconnectBtn = document.createElement('button');
            disconnectBtn.textContent = 'Disconnect from Strava';
            disconnectBtn.style.background = '#fc4c02';
            disconnectBtn.style.color = 'white';
            disconnectBtn.style.padding = '10px 20px';
            disconnectBtn.style.border = 'none';
            disconnectBtn.style.borderRadius = '5px';
            disconnectBtn.style.cursor = 'pointer';
            disconnectBtn.style.fontWeight = 'bold';
            disconnectBtn.style.fontSize = '1em';
            disconnectBtn.style.marginTop = '10px';
            disconnectBtn.onclick = async function() {
                await deleteDoc(stravaDocRef);
                // Reload settings summary after disconnect
                const user = auth.currentUser;
                if (user) {
                    const docRef = doc(db, "users", user.uid, "settings", "profile");
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        displaySettingsAsText(docSnap.data());
                    } else {
                        fillForm({});
                        updateStravaStatus();
                    }
                }
            };
            btnContainer.appendChild(disconnectBtn);
        }
    } else {
        statusDiv.textContent = "Strava not connected";
        statusDiv.style.color = "#888";
        // Show connect button if not connected
        if (btnContainer) {
            const connectBtn = document.createElement('button');
            connectBtn.textContent = 'Connect to Strava';
            connectBtn.style.background = '#fc4c02';
            connectBtn.style.color = 'white';
            connectBtn.style.padding = '10px 20px';
            connectBtn.style.border = 'none';
            connectBtn.style.borderRadius = '5px';
            connectBtn.style.cursor = 'pointer';
            connectBtn.style.fontWeight = 'bold';
            connectBtn.style.fontSize = '1em';
            connectBtn.onclick = function() {
                const clientId = '164917';
                const redirectUri = 'https://grit-802e6.web.app/setting.html'; // or your deployed URL
                const scope = 'read,activity:read';
                const stravaAuthUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&approval_prompt=auto&scope=${scope}`;
                window.location.href = stravaAuthUrl;
            };
            btnContainer.appendChild(connectBtn);
        }
    }
}
