import { auth, db } from './script.js';
import { doc, getDoc, collection, addDoc, query, orderBy, limit, getDocs, setDoc } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async function () {
    const addIntervalButton = document.getElementById('addIntervalButton');
    const saveTrainingButton = document.getElementById('saveTraining');

    // Store intervals in an array
    let intervals = [];

    function getPeriodStart(period) {
    const now = new Date();
    if (period === 'week') {
        // Set to most recent Monday
        const day = now.getDay(); // 0 (Sun) - 6 (Sat)
        const diff = now.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
        const monday = new Date(now.setDate(diff));
        monday.setHours(0, 0, 0, 0);
        return monday;
    }
    if (period === 'month') {
        const first = new Date(now.getFullYear(), now.getMonth(), 1);
        first.setHours(0, 0, 0, 0);
        return first;
    }
    if (period === 'year') {
        const jan1 = new Date(now.getFullYear(), 0, 1);
        jan1.setHours(0, 0, 0, 0);
        return jan1;
    }
    // allTime: return a very old date
    return new Date(2000, 0, 1);
}

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
        displayCurrentStreak(); // <-- add this line
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
        if (!trimpAvg28 || trimpAvg28 === 0) return 0; // avoid division by zero
        return (
            0.222 * trimp +
            0.07 * streak -
            0.9 * (trimpAvg7 / trimpAvg28)
        );
    }

    async function updatePreview() {
        // Only show preview if at least one interval exists
        if (intervals.length === 0) {
            previewDiv.innerHTML = '';
            previewDiv.style.display = 'none';
            return;
        }
        previewDiv.style.display = 'block';
        const title = document.getElementById('trainingTitle').value;
        const date = document.getElementById('trainingDate').value;
        const type = document.getElementById('trainingType') ? document.getElementById('trainingType').value : '';

        // Calculate totals and averages
        let totalDistance = 0;
        let totalDuration = 0; // in seconds
        let totalHr = 0;
        let totalRpe = 0;

        intervals.forEach(interval => {
            // Distance
            totalDistance += parseFloat(interval.distance) || 0;
            // Duration (convert from HH:MM:SS or MM:SS to seconds)
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
            // HR
            totalHr += parseFloat(interval.hrAvg) || 0;
            // RPE
            totalRpe += parseFloat(interval.rpe) || 0;
        });

        // Format total duration as minutes with 2 decimals
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
        html += `<strong>Title:</strong> ${title || ''}<br>`;
        html += `<strong>Date:</strong> ${date || ''}<br>`;
        html += `<strong>Type:</strong> ${type || ''}<br>`;
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

    let trainingsCache = [];
    let currentPage = 0;
    const trainingsPerPage = 5;

    async function fetchAllTrainings() {
        const user = auth.currentUser;
        if (!user) return [];
        const trainingsRef = collection(db, "users", user.uid, "trainings");
        const q = query(trainingsRef, orderBy("createdAt", "desc"));
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
                html += `<li class="training-item" data-index="${i}">
                    <strong>${t.title || 'No title'}</strong> (${t.date || 'No date'})<br>
                    Type: ${t.type || ''}<br>
                    Intervals: ${t.intervals ? t.intervals.length : 0}
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
                showTrainingDetails(trainingsCache[idx]);
            });
        });
    }

    function showTrainingDetails(training) {
        const detailsDiv = document.getElementById('trainingDetails');
        if (!detailsDiv || !training) return;
        let html = `<h4>Training Details</h4>`;
        html += `<strong>Title:</strong> ${training.title || ''}<br>`;
        html += `<strong>Date:</strong> ${training.date || ''}<br>`;
        html += `<strong>Type:</strong> ${training.type || ''}<br>`;
        html += `<strong>Total TRIMP:</strong> ${typeof training.trimp === 'number' ? training.trimp.toFixed(2) : 'N/A'}<br>`;
        // Always use the already saved gritScore value
        html += `<strong>GRIT Score:</strong> ${typeof training.gritScore === 'number' ? training.gritScore.toFixed(2) : (training.gritScore || 'N/A')}<br>`;
        if (training.intervals && training.intervals.length > 0) {
            html += `<strong>Intervals:</strong><ul>`;
            training.intervals.forEach((interval, i) => {
                html += `<li>
                    <strong>Interval ${i + 1}:</strong>
                    Duration: ${interval.duration}, 
                    Distance: ${interval.distance} km, 
                    HR Avg: ${interval.hrAvg}, 
                    RPE: ${interval.rpe}
                </li>`;
            });
            html += `</ul>`;
        }
        detailsDiv.innerHTML = html;
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
                }
            };
        }
        if (nextBtn) {
            nextBtn.onclick = () => {
                if ((currentPage + 1) * trainingsPerPage < trainingsCache.length) {
                    currentPage++;
                    lastTrainingsDiv.innerHTML = renderTrainingsPage(trainingsCache, currentPage);
                    addTrainingsNavListeners();
                }
            };
        }
    }

    // When a new training is saved, reset cache and page
    async function refreshTrainingsAfterSave() {
        trainingsCache = [];
        currentPage = 0;
        await displayLastTrainings();
    }

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

        const totalTRIMP = calcTRIMP(intervals, maxHr, restHr, lambda);
        const streak = await getStreak(user);

        const trainingData = {
            title: document.getElementById('trainingTitle').value,
            date: document.getElementById('trainingDate').value,
            type: document.getElementById('trainingType').value,
            intervals: intervals,
            createdAt: new Date().toISOString(),
            trimp: totalTRIMP,
            gritScore: 0 // temporary, will update after
        };

        try {
            const trainingsRef = collection(db, "users", user.uid, "trainings");
            // 1. Add the training first
            const docRef = await addDoc(trainingsRef, trainingData);

            // 2. Now recalculate averages including this training
            // Fetch all trainings again (including the new one)
            const allTrainingsSnap = await getDocs(query(trainingsRef, orderBy("date", "desc")));
            let trimp7 = 0, trimp28 = 0, count7 = 0, count28 = 0;
            const now = new Date();
            allTrainingsSnap.forEach(docSnap => {
                const t = docSnap.data();
                if (t.trimp && t.date) {
                    const trainDate = new Date(t.date);
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
            const avgTrimp7 = count7 ? trimp7 / count7 : 0;
            const avgTrimp28 = count28 ? trimp28 / count28 : 0;

            const gritScore = calcGRIT({
                trimp: totalTRIMP,
                streak: streak,
                trimpAvg7: avgTrimp7,
                trimpAvg28: avgTrimp28
            });

            // 3. Update the training with the correct gritScore
            await setDoc(docRef, { ...trainingData, gritScore }, { merge: true });

            showMessage('Training saved!');
            intervals = [];
            resetTrainingInputs();
            updatePreview();
            updateGritScoreDisplay(gritScore);
            await refreshTrainingsAfterSave();

            // --- Calculate and update grit scores for all periods ---
            async function getTrimpSum(days) {
                const { trimpSum } = await getTrainingsForPeriod(user, days);
                return trimpSum;
            }
            const weekData = await getTrainingsForPeriod(user, 'week');
            const monthData = await getTrainingsForPeriod(user, 'month');
            const yearData = await getTrainingsForPeriod(user, 'year');
            const allTimeData = await getTrainingsForPeriod(user, 'allTime');

            const trimp7Period = weekData.avg;
            const trimp28Period = monthData.avg; // or use a separate 28-day period if you want

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
            // Set to most recent Monday
            const day = now.getDay(); // 0 (Sun) - 6 (Sat)
            const diff = now.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
            return new Date(now.setDate(diff)).setHours(0,0,0,0);
        }
        if (period === 'month') {
            return new Date(now.getFullYear(), now.getMonth(), 1).setHours(0,0,0,0);
        }
        if (period === 'year') {
            return new Date(now.getFullYear(), 0, 1).setHours(0,0,0,0);
        }
        // allTime: return a very old date
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

    async function getStreak(user) {
        const trainingsRef = collection(db, "users", user.uid, "trainings");
        const q = query(trainingsRef, orderBy("date", "desc"));
        const querySnapshot = await getDocs(q);
        let streak = 0;
        let prevDate = null;
        for (const docSnap of querySnapshot.docs) {
            const t = docSnap.data();
            if (!t.date) continue;
            const trainDate = new Date(t.date);
            if (!prevDate) {
                prevDate = trainDate;
                streak = 1;
            } else {
                const diff = (prevDate - trainDate) / (1000 * 60 * 60 * 24);
                if (diff <= 1.5) {
                    streak++;
                    prevDate = trainDate;
                } else {
                    break;
                }
            }
        }
        return streak;
    }

    function updateGritScoreDisplay(gritScore) {
        const gritDiv = document.getElementById('gritScore');
        if (gritDiv) {
            gritDiv.innerHTML = `<strong>All time GRIT Score:</strong> ${gritScore.toFixed(2)}`;
        }
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

            // Streak calculation
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
                // TRIMP averages
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

        // Display on dashboard
        updateGritScoreDisplay(gritScore);

        // Save to Firestore in a new 'grit' collection
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
        // Remove previewDiv if already in DOM
        if (previewDiv.parentNode) previewDiv.parentNode.removeChild(previewDiv);
        // Insert previewDiv before lastTrainingsDiv
        lastTrainingsDiv.parentNode.insertBefore(previewDiv, lastTrainingsDiv);
    } else {
        // Fallback: append to body if lastTrainingsDiv not found
        document.body.appendChild(previewDiv);
    }

    // Initial preview and last trainings
    updatePreview();
    displayLastTrainings();
    displayAllTimeGritScore();
    displayCurrentStreak();
});


// Call this after a training is saved
async function updateGritScores(userId, newScores) {
    // newScores: { week: 123, month: 456, year: 789, allTime: 999 }
    for (const period of ['week', 'month', 'year', 'allTime']) {
        await setDoc(doc(db, "users", userId, "grit", period), { score: newScores[period] || 0 });
    }
}

