import { auth, db } from './script.js';
import { doc, getDoc, collection, addDoc, query, orderBy, getDocs, setDoc, where, onSnapshot } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
let selectedTrainingIndex = null;
let trainingsCache = [];
let currentPage = 0;
const trainingsPerPage = 10;

// --- GLOBAL FUNCTIONS ---

function calcGRIT({ trimp, streak, trimpAvg7, trimpAvg28 }) {
    const safeTrimpAvg28 = trimpAvg28 && trimpAvg28 > 0 ? trimpAvg28 : trimp;
    const safeTrimpAvg7 = trimpAvg7 && trimpAvg7 > 0 ? trimpAvg7 : trimp;
    return (
        0.222 * trimp +
        0.07 * streak -
        0.9 * (safeTrimpAvg7 / safeTrimpAvg28)
    );
}

function updateGritScoreDisplay(score) {
    const gritDiv = document.getElementById('gritScore');
    if (gritDiv) {
        gritDiv.innerHTML = `<strong>GRIT Score:</strong> ${typeof score === 'number' ? score.toFixed(2) : (score || 'N/A')}`;
    }
}

async function fetchAllTrainings() {
    const user = auth.currentUser;
    if (!user) return [];
    const trainingsRef = collection(db, "users", user.uid, "trainings");
    const q = query(trainingsRef, orderBy("date", "desc"));
    const querySnapshot = await getDocs(q);
    const trainings = [];
    querySnapshot.forEach(docSnap => {
        const t = docSnap.data();
        trainings.push(t);
    });
    return trainings;
}

function renderTrainingsPage(trainings, page) {
    let html = "<h3>Last Trainings</h3>";
    if (trainings.length === 0) {
        html += "<p>No trainings found.</p>";
    } else {
        html += "<ul>";
        const start = page * trainingsPerPage;
        const end = Math.min(start + trainingsPerPage, trainings.length);
        for (let i = start; i < end; i++) {
            const t = trainings[i];
            html += `<li class="training-item" data-index="${i}" style="cursor:pointer;">
                <strong>${t.title || 'No title'}</strong> (${t.date || 'No date'})<br>
                Type: ${t.type || ''}<br>
            </li>`;
        }
        html += "</ul>";
        // Navigation arrows
        html += `<div style="margin-top:10px;">`;
        html += `<button id="prevTrainings" ${page === 0 ? "disabled" : ""}>&larr; Prev</button>`;
        html += `<span style="margin:0 10px;">Page ${page + 1} of ${Math.ceil(trainings.length / trainingsPerPage)}</span>`;
        html += `<button id="nextTrainings" ${end >= trainings.length ? "disabled" : ""}>Next &rarr;</button>`;
        html += `</div>`;
    }
    // Add a container for training details
    html += `<div id="trainingDetails"></div>`;
    return html;
}

async function displayLastTrainings() {
    const lastTrainingsDiv = document.getElementById('lastTrainings');
    if (!lastTrainingsDiv) return;
    const user = auth.currentUser;
    if (!user) {
        lastTrainingsDiv.innerHTML = "<h3>Last Trainings</h3><p>Please log in to see your last trainings.</p>";
        return;
    }
    // Fetch and cache all trainings only once per session
    if (trainingsCache.length === 0) {
        trainingsCache = await fetchAllTrainings();
    }
    lastTrainingsDiv.innerHTML = renderTrainingsPage(trainingsCache, currentPage);

    // Add event listeners for navigation
    addTrainingsNavListeners();

    // Add click listeners for training items
    document.querySelectorAll('.training-item').forEach(item => {
        item.addEventListener('click', function () {
            const idx = parseInt(this.getAttribute('data-index'));
            selectedTrainingIndex = idx; // Track selected training
            showTrainingDetails(trainingsCache[idx]);
        });
    });

    // If a training is selected, show its details after page change
    if (
        selectedTrainingIndex !== null &&
        selectedTrainingIndex >= currentPage * trainingsPerPage &&
        selectedTrainingIndex < Math.min((currentPage + 1) * trainingsPerPage, trainingsCache.length)
    ) {
        showTrainingDetails(trainingsCache[selectedTrainingIndex]);
    } else {
        // Clear details if selected training is not on this page
        document.getElementById('trainingDetails').innerHTML = '';
    }
}

function showTrainingDetails(training) {
    const detailsDiv = document.getElementById('trainingDetails');
    if (!detailsDiv || !training) return;
    let html = `
        <div style="display: flex; justify-content: center; align-items: center; margin-bottom: 10px; position: relative;">
            <h4 style="margin: 0; flex: 1; text-align: center;">Training Details</h4>
            <button id="closeTrainingDetails" 
                style="
                    background:#BF1A2F;
                    color:white;
                    border:none;
                    border-radius:4px;
                    padding:6px 16px;
                    cursor:pointer;
                    font-weight:bold;
                    font-size:1em;
                    margin-right: 20px;
                    position: absolute;
                    right: 0;
                    top: 50%;
                    transform: translateY(-50%);
                ">
                Close
            </button>
        </div>
    `;
    html += `<div style="text-align:center;">`;
    html += `<strong>Title:</strong> ${training.title || ''}<br>`;
    html += `<strong>Date:</strong> ${training.date || ''}<br>`;
    html += `<strong>Type:</strong> ${training.type || ''}<br>`;
    html += `<strong>Total Duration:</strong> ${typeof training.duration === 'number' ? training.duration.toFixed(2) + ' min' : 'N/A'}<br>`;
    html += `<strong>Total Distance:</strong> ${typeof training.distance === 'number' ? training.distance.toFixed(2) + ' km' : 'N/A'}<br>`;
    html += `<strong>Total Climb:</strong> ${typeof training.totalClimb === 'number' ? training.totalClimb + ' m' : 'N/A'}<br>`;
    html += `<strong>Avg Heartrate:</strong> ${typeof training.hrAvg === 'number' ? training.hrAvg + ' bpm' : 'N/A'}<br>`;
    html += `<strong>Total TRIMP:</strong> ${typeof training.trimp === 'number' ? training.trimp.toFixed(2) : 'N/A'}<br>`;
    html += `<strong>GRIT Score:</strong> ${typeof training.gritScore === 'number' ? training.gritScore.toFixed(2) : (training.gritScore || 'N/A')}<br>`;
    if (training.intervals && training.intervals.length > 0) {
        html += `<strong>Intervals:</strong><ul style="display:inline-block; text-align:left;">`;
        training.intervals.forEach((interval, i) => {
            html += `<li>
                <strong>Interval ${i + 1}:</strong>
                Duration: ${interval.duration || 'N/A'}, 
                Distance: ${interval.distance || 'N/A'} km, 
                HR Avg: ${interval.hrAvg || 'N/A'}, 
                RPE: ${interval.rpe || 'N/A'}
            </li>`;
        });
        html += `</ul>`;
    }
    html += `</div>`;
    detailsDiv.innerHTML = html;

    // Add close button logic
    const closeBtn = document.getElementById('closeTrainingDetails');
    if (closeBtn) {
        closeBtn.onclick = function() {
            detailsDiv.innerHTML = '';
            selectedTrainingIndex = null;
        };
    }
}

// Helper to re-add listeners after re-render
function addTrainingsNavListeners() {
    const prevBtn = document.getElementById('prevTrainings');
    const nextBtn = document.getElementById('nextTrainings');
    const lastTrainingsDiv = document.getElementById('lastTrainings');
    if (prevBtn) {
        prevBtn.onclick = () => {
            if (currentPage > 0) {
                currentPage--;
                lastTrainingsDiv.innerHTML = renderTrainingsPage(trainingsCache, currentPage);
                addTrainingsNavListeners();
                if (
                    selectedTrainingIndex !== null &&
                    selectedTrainingIndex >= currentPage * trainingsPerPage &&
                    selectedTrainingIndex < Math.min((currentPage + 1) * trainingsPerPage, trainingsCache.length)
                ) {
                    showTrainingDetails(trainingsCache[selectedTrainingIndex]);
                } else {
                    document.getElementById('trainingDetails').innerHTML = '';
                }
                document.querySelectorAll('.training-item').forEach(item => {
                    item.addEventListener('click', function () {
                        const idx = parseInt(this.getAttribute('data-index'));
                        selectedTrainingIndex = idx;
                        showTrainingDetails(trainingsCache[idx]);
                    });
                });
            }
        };
    }
    if (nextBtn) {
        nextBtn.onclick = () => {
            if ((currentPage + 1) * trainingsPerPage < trainingsCache.length) {
                currentPage++;
                lastTrainingsDiv.innerHTML = renderTrainingsPage(trainingsCache, currentPage);
                addTrainingsNavListeners();
                if (
                    selectedTrainingIndex !== null &&
                    selectedTrainingIndex >= currentPage * trainingsPerPage &&
                    selectedTrainingIndex < Math.min((currentPage + 1) * trainingsPerPage, trainingsCache.length)
                ) {
                    showTrainingDetails(trainingsCache[selectedTrainingIndex]);
                } else {
                    document.getElementById('trainingDetails').innerHTML = '';
                }
                document.querySelectorAll('.training-item').forEach(item => {
                    item.addEventListener('click', function () {
                        const idx = parseInt(this.getAttribute('data-index'));
                        selectedTrainingIndex = idx;
                        showTrainingDetails(trainingsCache[idx]);
                    });
                });
            }
        };
    }
}

// Helper to get today's date in YYYY-MM-DD format
function getTodayDateString() {
    const today = new Date();
    return today.toISOString().slice(0, 10);
}

// Fetch today's activities from Strava
async function fetchTodaysStravaActivities(accessToken) {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() / 1000;
    const endOfDay = startOfDay + 86400;
    const url = `https://www.strava.com/api/v3/athlete/activities?after=${startOfDay}&before=${endOfDay}&per_page=10`;
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });
    if (!response.ok) throw new Error('Failed to fetch Strava activities');
    return await response.json();
}

async function refreshStravaAccessToken(refreshToken) {
    const client_id = '164917';
    const client_secret = 'b2f41f859d5860b1c8e0103b9b6a8667489c78d7';
    const params = new URLSearchParams({
        client_id,
        client_secret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
    });
    const response = await fetch('https://www.strava.com/api/v3/oauth/token', {
        method: 'POST',
        body: params
    });
    if (!response.ok) throw new Error('Failed to refresh Strava token');
    return await response.json();
}

async function checkAndFetchTodaysTraining(user) {
    const statusDiv = document.getElementById('trainingStatus');
    if (statusDiv) statusDiv.textContent = "Checking today's training...";

    // 1. Check if today's training exists in Firestore
    const trainingsRef = collection(db, "users", user.uid, "trainings");
    const todayStr = getTodayDateString();
    const q = query(trainingsRef, where("date", "==", todayStr));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
        // Even if today's training exists, update its GRIT score!
        const user = auth.currentUser;
        const trainingsRef = collection(db, "users", user.uid, "trainings");
        const allTrainingsSnap = await getDocs(query(trainingsRef, orderBy("date", "desc")));
        let trimp7 = 0, trimp28 = 0, count7 = 0, count28 = 0;
        const now = new Date();
        let lastTraining = null;
        allTrainingsSnap.forEach(docSnap => {
            const t = docSnap.data();
            if (t.trimp && t.date) {
                const trainDate = parseLocalDate(t.date);
                const daysAgo = (now - trainDate) / (1000 * 60 * 60 * 24);
                if (daysAgo <= 7) {
                    trimp7 += t.trimp;
                    count7++;
                }
                if (daysAgo <= 28) {
                    trimp28 += t.trimp;
                    count28++;
                }
                // Find the most recent training (today's)
                if (!lastTraining && t.date === getTodayDateString()) {
                    lastTraining = { ...t, id: docSnap.id };
                }
            }
        });
        if (lastTraining) {
            const avgTrimp7 = count7 ? trimp7 / count7 : lastTraining.trimp;
            const avgTrimp28 = count28 ? trimp28 / count28 : lastTraining.trimp;
            const streak = await getStreak(user);
            const gritScore = calcGRIT({
                trimp: lastTraining.trimp,
                streak: streak,
                trimpAvg7: avgTrimp7,
                trimpAvg28: avgTrimp28
            });
            await setDoc(doc(trainingsRef, lastTraining.id), { gritScore }, { merge: true });
            console.log('GRIT DEBUG (existing training)', { trimp: lastTraining.trimp, streak, avgTrimp7, avgTrimp28, gritScore });
        }
        if (statusDiv) statusDiv.textContent = "Today's training is loaded.";
        return;
    }

    // 2. Get Strava access token
    const stravaDocRef = doc(db, "users", user.uid, "strava", "connection");
    const stravaDoc = await getDoc(stravaDocRef);
    if (!stravaDoc.exists() || !stravaDoc.data().connected) {
        if (statusDiv) statusDiv.textContent = "No Strava training loaded (not connected).";
        return;
    }
    let accessToken = stravaDoc.data().accessToken;
    let refreshToken = stravaDoc.data().refreshToken;
    let expiresAt = stravaDoc.data().expiresAt;

    // Check if token is expired
    if (expiresAt && Date.now() / 1000 > expiresAt) {
        try {
            const tokenData = await refreshStravaAccessToken(refreshToken);
            accessToken = tokenData.access_token;
            refreshToken = tokenData.refresh_token;
            expiresAt = tokenData.expires_at;
            await setDoc(stravaDocRef, {
                accessToken,
                refreshToken,
                expiresAt
            }, { merge: true });
        } catch (err) {
            if (statusDiv) statusDiv.textContent = "Failed to refresh Strava token.";
            return;
        }
    }

    // 3. Fetch today's activities from Strava
    try {
        const activities = await fetchTodaysStravaActivities(accessToken);
        if (activities.length > 0) {
            for (const activity of activities) {
                const trainingId = "strava_" + activity.id;
                const trainingRef = doc(db, "users", user.uid, "trainings", trainingId);
                const trainingSnap = await getDoc(trainingRef);

                // Always extract values (for both new and existing)
                const duration = Number.isFinite(activity.elapsed_time) ? activity.elapsed_time / 60 : 0; // minutes
                const distance = Number.isFinite(activity.distance) ? activity.distance / 1000 : 0; // km
                const totalClimb = Number.isFinite(activity.total_elevation_gain) ? activity.total_elevation_gain : 0;
                const hrAvg = Number.isFinite(activity.average_heartrate) ? activity.average_heartrate : 0;
                const maxHr = parseFloat(activity.max_heartrate) || 190;
                const restHr = 60;
                const lambda = 1.92;
                const HRr = maxHr && restHr ? (hrAvg - restHr) / (maxHr - restHr) : 0;
                const trimp = duration * HRr * 0.64 * Math.exp(lambda * HRr);

                if (!trainingSnap.exists()) {
                    // Save new Strava training
                    const trainingData = {
                        title: activity.name,
                        date: activity.start_date_local ? activity.start_date_local.slice(0, 10) : "",
                        type: activity.type ? activity.type.toLowerCase() : "other",
                        intervals: [],
                        trimp: trimp || 0,
                        gritScore: 0,
                        source: "strava",
                        stravaId: activity.id,
                        createdAt: new Date().toISOString(),
                        duration,
                        distance,
                        totalClimb,
                        hrAvg
                    };
                    await setDoc(trainingRef, trainingData);
                }

                // Always recalculate and update gritScore
                const allTrainingsSnap = await getDocs(query(trainingsRef, orderBy("date", "desc")));
                let trimp7 = 0, trimp28 = 0, count7 = 0, count28 = 0;
                const now = new Date();
                allTrainingsSnap.forEach(docSnap => {
                    const t = docSnap.data();
                    if (t.trimp && t.date) {
                        const trainDate = parseLocalDate(t.date);
                        const daysAgo = (now - trainDate) / (1000 * 60 * 60 * 24);
                        if (daysAgo <= 7) {
                            trimp7 += t.trimp;
                            count7++;
                        }
                        if (daysAgo <= 28) {
                            trimp28 += t.trimp;
                            count28++;
                        }
                    }
                });
                // Fallback to current trimp if no trainings in window
                const avgTrimp7 = count7 ? trimp7 / count7 : trimp;
                const avgTrimp28 = count28 ? trimp28 / count28 : trimp;
                const streak = await getStreak(user);
                const gritScore = calcGRIT({
                    trimp: trimp,
                    streak: streak,
                    trimpAvg7: avgTrimp7,
                    trimpAvg28: avgTrimp28
                });
                console.log('GRIT DEBUG', { trimp, streak, avgTrimp7, avgTrimp28, gritScore });
                await setDoc(trainingRef, { gritScore }, { merge: true });
            }
            if (statusDiv) statusDiv.textContent = "Today's Strava training loaded!";
            trainingsCache = [];
            await displayLastTrainings();
        } else {
            if (statusDiv) statusDiv.textContent = "No Strava training found for today.";
        }
    } catch (err) {
        if (statusDiv) statusDiv.textContent = "Error fetching Strava training.";
    }

    toggleAddTrainingForm();
}

function formatMinutesToHHMMSS(minutesDecimal) {
    const totalSeconds = Math.round(minutesDecimal * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

async function toggleAddTrainingForm() {
    const user = auth.currentUser;
    const formContainer = document.getElementById('addTrainingFormContainer');
    const headline = document.getElementById('addTrainingHeadline');
    if (!user || !formContainer || !headline) return;

    // Check Strava connection
    const stravaDoc = await getDoc(doc(db, "users", user.uid, "strava", "connection"));
    if (stravaDoc.exists() && stravaDoc.data().connected) {
        // Hide form by default, show headline
        formContainer.style.display = "none";
        headline.style.cursor = "pointer";
        // Toggle form on headline click
        headline.onclick = () => {
            formContainer.style.display = (formContainer.style.display === "none") ? "block" : "none";
        };
    } else {
        // Show form by default, headline not clickable
        formContainer.style.display = "block";
        headline.style.cursor = "default";
        headline.onclick = null;
    }
}

// --- DOMContentLoaded and Auth logic ---

document.addEventListener('DOMContentLoaded', async function () {
    const addIntervalButton = document.getElementById('addIntervalButton');
    const saveTrainingButton = document.getElementById('saveTraining');

    // Store intervals in an array
    let intervals = [];

    // Create preview container
    const previewDiv = document.createElement('div');
    previewDiv.id = 'trainingPreview';
    previewDiv.style.border = '1px solid #ccc';
    previewDiv.style.padding = '10px';
    previewDiv.style.marginTop = '20px';
    document.body.appendChild(previewDiv);

    // Default values in case user settings are not loaded
    let maxHr = 190;
    let restHr = 60;
    let lambda = 1.92;

    // Fetch user settings from Firestore
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            const docRef = doc(db, "users", user.uid, "settings", "profile");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                maxHr = parseFloat(data.maxHr) || maxHr;
                restHr = parseFloat(data.restHr) || restHr;
                // Optionally set lambda based on sex
                if (data.sex && data.sex.toLowerCase() === 'female') {
                    lambda = 1.67;
                } else {
                    lambda = 1.92;
                }
            }
        }
        updatePreview();
        displayLastTrainings();
        displayAllTimeGritScore();
        displayCurrentStreak();
    });

    function calcTRIMP(intervals, maxHr, restHr, lambda) {
        let totalTRIMP = 0;
        intervals.forEach(interval => {
            let parts = interval.duration.split(':').map(Number);
            let minutes = 0;
            if (parts.length === 3) {
                // HH:MM:SS
                minutes = parts[0] * 60 + parts[1] + parts[2] / 60;
            } else if (parts.length === 2) {
                // MM:SS
                minutes = parts[0] + parts[1] / 60;
            } else if (parts.length === 1) {
                // MM
                minutes = parts[0];
            }
            const HRi = parseFloat(interval.hrAvg) || 0;
            const intensity = (HRi - restHr) / (maxHr - restHr);
            const trimp = minutes * intensity * Math.exp(lambda * intensity);
            totalTRIMP += trimp;
        });
        return totalTRIMP;
    }

    function calcGRIT({ trimp, streak, trimpAvg7, trimpAvg28 }) {
        if (!trimpAvg28 || trimpAvg28 === 0) return 0;
        return (
            0.222 * trimp +
            0.07 * streak -
            0.9 * (trimpAvg7 / trimpAvg28)
        );
    }

    async function updatePreview() {
        if (intervals.length === 0) {
            previewDiv.style.display = 'none';
            return;
        }
        previewDiv.style.display = 'block';
        const title = document.getElementById('trainingTitle')?.value || '';
        const date = document.getElementById('trainingDate')?.value || '';
        const type = document.getElementById('trainingType') ? document.getElementById('trainingType').value : '';

        // Calculate totals and averages
        let totalDistance = 0;
        let totalDuration = 0;
        let totalHr = 0;
        let totalRpe = 0;

        intervals.forEach(interval => {
            totalDistance += parseFloat(interval.distance) || 0;
            let parts = interval.duration.split(':').map(Number);
            let seconds = 0;
            if (parts.length === 3) {
                seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
            } else if (parts.length === 2) {
                seconds = parts[0] * 60 + parts[1];
            } else if (parts.length === 1) {
                seconds = parts[0];
            }
            totalDuration += seconds;
            totalHr += parseFloat(interval.hrAvg) || 0;
            totalRpe += parseFloat(interval.rpe) || 0;
        });

        function formatDurationMinutes(sec) {
            return (sec / 60).toFixed(2) + ' min';
        }

        const avgHr = intervals.length ? (totalHr / intervals.length).toFixed(1) : '0';
        const avgRpe = intervals.length ? (totalRpe / intervals.length).toFixed(1) : '0';
        const totalTRIMP = calcTRIMP(intervals, maxHr, restHr, lambda);

        let gritScore = 0;
        const user = auth.currentUser;
        if (user && intervals.length > 0) {
            const streak = await getStreak(user);
            const trimp7Preview = (await getTrainingsForPeriod(user, 7)).avg;
            const trimp28Preview = (await getTrainingsForPeriod(user, 28)).avg;
            gritScore = calcGRIT({
                trimp: totalTRIMP,
                streak: streak,
                trimpAvg7: trimp7Preview,
                trimpAvg28: trimp28Preview
            });
        }
        updateGritScoreDisplay(gritScore);

        let html = `<h3>Training Preview</h3>`;
        html += `<strong>Title:</strong> ${title}<br>`;
        html += `<strong>Date:</strong> ${date}<br>`;
        html += `<strong>Type:</strong> ${type}<br>`;
        html += `<strong>Total Distance:</strong> ${totalDistance.toFixed(2)} km<br>`;
        html += `<strong>Total Duration:</strong> ${formatDurationMinutes(totalDuration)}<br>`;
        html += `<strong>Avg Heartrate:</strong> ${avgHr} bpm<br>`;
        html += `<strong>Avg RPE:</strong> ${avgRpe}<br>`;
        html += `<strong>Total TRIMP:</strong> ${totalTRIMP.toFixed(2)}<br>`;
        html += `<strong>Intervals:</strong><br>`;
        html += `<ul>`;
        intervals.forEach((interval, i) => {
            html += `<li>
                <strong>Interval ${i + 1}:</strong> 
                Duration: ${interval.duration}, 
                Distance: ${interval.distance} km, 
                HR Avg: ${interval.hrAvg}, 
                RPE: ${interval.rpe}
            </li>`;
        });
        html += `</ul>`;
        previewDiv.innerHTML = html;
    }

    function validateTrainingInputs() {
        const requiredFields = [
            'trainingTitle',
            'trainingDate',
            'trainingType'
        ];
        for (let id of requiredFields) {
            const el = document.getElementById(id);
            if (!el || !el.value) {
                return false;
            }
        }
        return true;
    }

    function validateIntervalInputs() {
        const requiredFields = [
            'intervalDuration',
            'intervalDistance',
            'intervalHRavg',
            'intervalRPE'
        ];
        for (let id of requiredFields) {
            const el = document.getElementById(id);
            if (!el || !el.value) {
                return false;
            }
        }
        return true;
    }

    function resetIntervalInputs() {
        document.getElementById('intervalDuration').value = '';
        document.getElementById('intervalDistance').value = '';
        document.getElementById('intervalHRavg').value = '';
        document.getElementById('intervalRPE').value = '';
    }

    function resetTrainingInputs() {
        document.getElementById('trainingTitle').value = '';
        document.getElementById('trainingDate').value = '';
        document.getElementById('trainingType').selectedIndex = 0;
        resetIntervalInputs();
    }

    // Update preview on input changes
    ['trainingTitle', 'trainingDate', 'trainingType', 'intervalDuration', 'intervalDistance', 'intervalHRavg', 'intervalRPE'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', updatePreview);
        }
    });

    // Helper to show a temporary message
    function showMessage(msg, color = 'green') {
        let msgDiv = document.getElementById('dashboardMessage');
        if (!msgDiv) {
            msgDiv = document.createElement('div');
            msgDiv.id = 'dashboardMessage';
            msgDiv.style.position = 'fixed';
            msgDiv.style.top = '20px';
            msgDiv.style.left = '50%';
            msgDiv.style.transform = 'translateX(-50%)';
            msgDiv.style.padding = '10px 20px';
            msgDiv.style.borderRadius = '5px';
            msgDiv.style.zIndex = '1000';
            msgDiv.style.fontWeight = 'bold';
            document.body.appendChild(msgDiv);
        }
        msgDiv.textContent = msg;
        msgDiv.style.background = color === 'red' ? '#ffdddd' : '#ddffdd';
        msgDiv.style.color = color === 'red' ? '#a00' : '#070';
        msgDiv.style.display = 'block';
        setTimeout(() => {
            msgDiv.style.display = 'none';
        }, 3000);
    }

    addIntervalButton.addEventListener('click', function () {
        if (!validateTrainingInputs()) {
            showMessage('Please fill in all required training fields before adding an interval.', 'red');
            return;
        }
        if (!validateIntervalInputs()) {
            showMessage('Please fill in all required interval fields before adding an interval.', 'red');
            return;
        }
        const interval = {
            duration: document.getElementById('intervalDuration').value,
            distance: document.getElementById('intervalDistance').value,
            hrAvg: document.getElementById('intervalHRavg').value,
            rpe: document.getElementById('intervalRPE').value
        };
        intervals.push(interval);
        showMessage('Interval added!');
        resetIntervalInputs();
        updatePreview();
    });

    saveTrainingButton.addEventListener('click', async function () {
        if (!validateTrainingInputs()) {
            showMessage('Please fill in all required training fields before saving.', 'red');
            return;
        }
        if (intervals.length === 0) {
            showMessage('Please add at least one interval before saving the training.', 'red');
            return;
        }

        const user = auth.currentUser;
        if (!user) {
            showMessage('You must be logged in to save training.', 'red');
            return;
        }

        // Calculate totals for root fields
        let totalDistance = 0, totalDuration = 0, totalClimb = 0, hrSum = 0;
        intervals.forEach(i => {
            totalDistance += parseFloat(i.distance) || 0;
            let parts = i.duration.split(':').map(Number);
            let minutes = 0;
            if (parts.length === 3) {
                minutes = parts[0] * 60 + parts[1] + parts[2] / 60;
            } else if (parts.length === 2) {
                minutes = parts[0] + parts[1] / 60;
            } else if (parts.length === 1) {
                minutes = parts[0];
            }
            totalDuration += minutes;
            hrSum += parseFloat(i.hrAvg) || 0;
        });
        const avgHr = intervals.length > 0 ? hrSum / intervals.length : null;
        const totalTRIMP = calcTRIMP(intervals, maxHr, restHr, lambda);
        const streak = await getStreak(user);

        const trainingsRef = collection(db, "users", user.uid, "trainings");
        const allTrainingsSnap = await getDocs(query(trainingsRef, orderBy("date", "desc")));
        let trimp7 = 0, trimp28 = 0, count7 = 0, count28 = 0;
        const now = new Date();

        allTrainingsSnap.forEach(docSnap => {
            const t = docSnap.data();
            if (t.trimp && t.date) {
                const trainDate = parseLocalDate(t.date);
                const daysAgo = (now - trainDate) / (1000 * 60 * 60 * 24);
                if (daysAgo <= 7) {
                    trimp7 += t.trimp;
                    count7++;
                }
                if (daysAgo <= 28) {
                    trimp28 += t.trimp;
                    count28++;
                }
            }
        });

        const avgTrimp7 = count7 ? trimp7 / count7 : trimp;
        const avgTrimp28 = count28 ? trimp28 / count28 : trimp;
        const gritScore = calcGRIT({
            trimp: totalTRIMP,
            streak: streak,
            trimpAvg7: avgTrimp7,
            trimpAvg28: avgTrimp28
        });

        const trainingData = {
            title: document.getElementById('trainingTitle').value,
            date: document.getElementById('trainingDate').value,
            type: document.getElementById('trainingType').value,
            intervals: intervals,
            createdAt: new Date().toISOString(),
            trimp: totalTRIMP,
            duration: totalDuration,
            distance: totalDistance,
            totalClimb: totalClimb,
            hrAvg: avgHr,
            gritScore: gritScore
        };

        try {
            const docRef = await addDoc(trainingsRef, trainingData);

            showMessage('Training saved!');
            intervals = [];
            resetTrainingInputs();
            updatePreview();
            updateGritScoreDisplay(gritScore);
            if (typeof refreshTrainingsAfterSave === 'function') await refreshTrainingsAfterSave();

            const weekData = await getTrainingsForPeriod(user, 'week');
            const monthData = await getTrainingsForPeriod(user, 'month');
            const yearData = await getTrainingsForPeriod(user, 'year');
            const allTimeData = await getTrainingsForPeriod(user, 'allTime');

            const trimp7Period = weekData.avg;
            const trimp28Period = monthData.avg;

            const weekGrit = calcGRIT({ trimp: weekData.trimpSum, streak, trimpAvg7: trimp7Period, trimpAvg28: trimp28Period });
            const monthGrit = calcGRIT({ trimp: monthData.trimpSum, streak, trimpAvg7: trimp7Period, trimpAvg28: trimp28Period });
            const yearGrit = calcGRIT({ trimp: yearData.trimpSum, streak, trimpAvg7: trimp7Period, trimpAvg28: trimp28Period });
            const allTimeGrit = calcGRIT({ trimp: allTimeData.trimpSum, streak, trimpAvg7: trimp7Period, trimpAvg28: trimp28Period });

            await updateGritScores(user.uid, {
                week: weekGrit,
                month: monthGrit,
                year: yearGrit,
                allTime: allTimeGrit
            });

            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (error) {
            showMessage('Error saving training: ' + error.message, 'red');
        }
    });

    function getPeriodStart(period) {
        const now = new Date();
        if (period === 'week') {
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1);
            return new Date(now.setDate(diff)).setHours(0,0,0,0);
        }
        if (period === 'month') {
            return new Date(now.getFullYear(), now.getMonth(), 1).setHours(0,0,0,0);
        }
        if (period === 'year') {
            return new Date(now.getFullYear(), 0, 1).setHours(0,0,0,0);
        }
        return new Date(2000, 0, 1).setHours(0,0,0,0);
    }

    async function getTrainingsForPeriod(user, period) {
        const trainingsRef = collection(db, "users", user.uid, "trainings");
        const q = query(trainingsRef, orderBy("date", "desc"));
        const querySnapshot = await getDocs(q);
        let trimpSum = 0;
        let count = 0;
        const periodStart = getPeriodStart(period);

        querySnapshot.forEach(docSnap => {
            const t = docSnap.data();
            if (t.date && new Date(t.date) >= periodStart && t.trimp) {
                trimpSum += t.trimp;
                count++;
            }
        });
        return { trimpSum, count, avg: count ? trimpSum / count : 0 };
    }

    async function getStreak(user, upToDate = null) {
        const trainingsRef = collection(db, "users", user.uid, "trainings");
        const q = query(trainingsRef, orderBy("date", "desc"));
        const querySnapshot = await getDocs(q);

        let streak = 0;
        let prevDate = null;
        for (const docSnap of querySnapshot.docs) {
            const t = docSnap.data();
            if (!t.date) continue;
            const trainDate = new Date(t.date.toDate ? t.date.toDate() : t.date);
            if (upToDate && trainDate > new Date(upToDate)) continue;
            if (!prevDate) {
                prevDate = trainDate;
                streak = 1;
            } else {
                const diffDays = Math.round((prevDate - trainDate) / (1000 * 60 * 60 * 24));
                if (diffDays === 1) {
                    streak++;
                    prevDate = trainDate;
                } else if (diffDays === 0) {
                    continue;
                } else {
                    break;
                }
            }
        }
        return streak;
    }

    async function displayAllTimeGritScore() {
        const user = auth.currentUser;
        if (!user) {
            updateGritScoreDisplay(0);
            return;
        }
        const trainingsRef = collection(db, "users", user.uid, "trainings");
        const q = query(trainingsRef, orderBy("date", "desc"));
        const querySnapshot = await getDocs(q);

        let trimpSum = 0;
        let streak = 0;
        let prevDate = null;
        let trimp7 = 0, trimp28 = 0, count7 = 0, count28 = 0;
        const now = new Date();

        querySnapshot.forEach(docSnap => {
            const t = docSnap.data();
            if (t.trimp) trimpSum += t.trimp;

            if (t.date) {
                const trainDate = new Date(t.date);
                if (!prevDate) {
                    prevDate = trainDate;
                    streak = 1;
                } else {
                    const diff = (prevDate - trainDate) / (1000 * 60 * 60 * 24);
                    if (diff <= 1.5) {
                        streak++;
                        prevDate = trainDate;
                    }
                }
                const daysAgo = (now - trainDate) / (1000 * 60 * 60 * 24);
                if (daysAgo <= 7 && t.trimp) {
                    trimp7 += t.trimp;
                    count7++;
                }
                if (daysAgo <= 28 && t.trimp) {
                    trimp28 += t.trimp;
                    count28++;
                }
            }
        });

        const avgTrimp7 = count7 ? trimp7 / count7 : 0;
        const avgTrimp28 = count28 ? trimp28 / count28 : 0;

        const gritScore = calcGRIT({
            trimp: trimpSum,
            streak: streak,
            trimpAvg7: avgTrimp7,
            trimpAvg28: avgTrimp28
        });

        const gritDocRef = doc(db, "users", user.uid, "grit", "allTime");
        await setDoc(gritDocRef, {
            score: gritScore,
            updatedAt: new Date().toISOString()
        });
    }

    async function displayCurrentStreak() {
        const user = auth.currentUser;
        const streakDiv = document.getElementById('currentStreak');
        if (!user || !streakDiv) {
            if (streakDiv) streakDiv.textContent = '';
            return;
        }
        const streak = await getStreak(user);
        streakDiv.innerHTML = `<strong>Current Streak:</strong> ${streak} day${streak === 1 ? '' : 's'}`;
    }

    // Move previewDiv above lastTrainings
    const lastTrainingsDiv = document.getElementById('lastTrainings');
    if (lastTrainingsDiv) {
        if (previewDiv.parentNode) previewDiv.parentNode.removeChild(previewDiv);
        lastTrainingsDiv.parentNode.insertBefore(previewDiv, lastTrainingsDiv);
    } else {
        document.body.appendChild(previewDiv);
    }

    updatePreview();
    displayLastTrainings();
});

// Call this after a training is saved
async function updateGritScores(userId, newScores) {
    for (const period of ['week', 'month', 'year', 'allTime']) {
        await setDoc(doc(db, "users", userId, "grit", period), { score: newScores[period] || 0 });
    }
}

// Strava integration and auto-fetch today's training
onAuthStateChanged(auth, (user) => {
    const statusDiv = document.getElementById('trainingStatus');
    if (!user) {
        if (statusDiv) statusDiv.textContent = "Not logged in.";
        return;
    }
    checkAndFetchTodaysTraining(user);
    toggleAddTrainingForm();
});

// Listen for changes in Strava connection
onAuthStateChanged(auth, (user) => {
    if (user) {
        const stravaDocRef = doc(db, "users", user.uid, "strava", "connection");
        onSnapshot(stravaDocRef, () => {
            toggleAddTrainingForm();
        });
    }
});


function parseLocalDate(dateStr) {
    if (!dateStr) return new Date();
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d);
    }
    return new Date(dateStr);
}

