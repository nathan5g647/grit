import { db, auth } from './script.js';
import { collection, getDocs, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-storage.js";

function getUidFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('uid');
}
const paramsUid = getUidFromUrl();

function formatTime(minutes) {
    const h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
    return (h > 0 ? h + "h " : "") + m + "m";
}

function calculateStreaks(trainingDates) {
    if (trainingDates.length === 0) return { current: 0, longest: 0 };

    // Sort all training dates ascending by timestamp
    const sortedDates = trainingDates
        .map(d => new Date(d))
        .filter(d => !isNaN(d))
        .sort((a, b) => a - b);

    // Keep only the earliest training per calendar day
    const uniqueDates = [];
    let lastDay = null;
    for (let i = 0; i < sortedDates.length; i++) {
        const dayStr = sortedDates[i].getFullYear() + '-' + (sortedDates[i].getMonth()+1).toString().padStart(2, '0') + '-' + sortedDates[i].getDate().toString().padStart(2, '0');
        if (lastDay !== dayStr) {
            uniqueDates.push(sortedDates[i]);
            lastDay = dayStr;
        }
    }

    let longest = 1;
    let temp = 1;

    // Calculate longest streak (30h rule)
    for (let i = 1; i < uniqueDates.length; i++) {
        let diffHours = (uniqueDates[i] - uniqueDates[i - 1]) / (1000 * 60 * 60);
        if (diffHours <= 30) {
            temp++;
        } else {
            temp = 1;
        }
        if (temp > longest) longest = temp;
    }

    // Calculate current streak (rolling 30h window, up to the last training)
    let current = 1;
    for (let i = uniqueDates.length - 1; i > 0; i--) {
        let diffHours = (uniqueDates[i] - uniqueDates[i - 1]) / (1000 * 60 * 60);
        if (diffHours <= 30) {
            current++;
        } else {
            break;
        }
    }

    return { current, longest };
}

function getPeriodStart(period) {
    const now = new Date();
    if (period === "week") {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday as start
        return new Date(now.setDate(diff));
    }
    if (period === "month") {
        return new Date(now.getFullYear(), now.getMonth(), 1);
    }
    if (period === "year") {
        return new Date(now.getFullYear(), 0, 1);
    }
    return new Date(0); // allTime
}

function sumGritForPeriod(trainings, period) {
    if (period === "allTime") {
        return trainings.reduce((sum, t) => sum + (t.gritPoints || t.gritScore || t.grit || 0), 0);
    }
    const periodStart = getPeriodStart(period);
    return trainings
        .filter(t => {
            const dateStr = t.date || t.createdAt;
            if (!dateStr) return false;
            const d = new Date(dateStr);
            return d >= periodStart;
        })
        .reduce((sum, t) => sum + (t.gritPoints || t.gritScore || t.grit || 0), 0);
}

async function loadProfile(uid, isSelf) {
    // Fetch username from settings/profile
    const profileDocRef = doc(db, "users", uid, "settings", "profile");
    const profileDocSnap = await getDoc(profileDocRef);
    let username = null;
    if (profileDocSnap.exists()) {
        const profileData = profileDocSnap.data();
        if (profileData.username && profileData.username.length > 0) {
            username = profileData.username; // Use as-is, no capitalization
        }
    }
    // Fallback: try to get username from users/{uid}
    if (!username) {
        const userDocSnap = await getDoc(doc(db, "users", uid));
        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            if (userData.username && userData.username.length > 0) {
                username = userData.username; // Use as-is, no capitalization
            }
        }
    }
    if (!username) username = "User";
    // Set the page title and <title> tag
    const h1 = document.querySelector("main h1");
    if (h1) {
        h1.textContent = isSelf ? "My Profile" : `${username}'s Profile`;
    }
    document.title = isSelf ? "My Profile" : `${username}'s Profile | GRIT`;

    const usernameElem = document.getElementById('profileUsername');
    if (usernameElem) usernameElem.textContent = username;

    // Profile photo or initial
    let photoURL = null;
    try {
        const userDocSnap = await getDoc(doc(db, "users", uid));
        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            if (userData && userData.photoURL) {
                photoURL = userData.photoURL;
            }
        }
    } catch (e) {}

    const userPhotoImg = document.getElementById('userPhotoImg');
    const userPhotoInitial = document.getElementById('userPhotoInitial');
    if (userPhotoImg && userPhotoInitial) {
        if (photoURL) {
            userPhotoImg.src = photoURL;
            userPhotoImg.style.display = "block";
            userPhotoInitial.style.display = "none";
        } else {
            userPhotoImg.style.display = "none";
            const initial = (username && username.length > 0)
                ? username.charAt(0).toUpperCase()
                : "?";
            userPhotoInitial.textContent = initial;
            userPhotoInitial.style.display = "block";
        }
    }
}

onAuthStateChanged(auth, async (user) => {
    let uid = paramsUid || (user && user.uid);
    console.log("Profile page UID:", uid); // <-- Add this line
    if (!uid) {
        document.getElementById('profileUsername').textContent = "User";
        return;
    }
    const isSelf = user && uid === user.uid;
    await loadProfile(uid, isSelf);

    // Fetch last 3 trainings and streak for any user
    const trainingsRef = collection(db, "users", uid, "trainings");
    const trainingsSnap = await getDocs(trainingsRef);
    let trainings = [];
    trainingsSnap.forEach(doc => {
        trainings.push(doc.data());
    });
    trainings.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
    const last3 = trainings.slice(0, 3);

    let lastTrainingsHtml = "";
    // --- Last 3 Trainings Table ---
    if (last3.length === 0) {
        lastTrainingsHtml = "<p>No trainings found.</p>";
    } else {
        lastTrainingsHtml = `<table class="leaderboard-table"><tr><th>Type</th><th>Duration</th><th>Distance (km)</th><th>GRIT</th></tr>`;
        last3.forEach(t => {
            const type = t.type ? t.type.charAt(0).toUpperCase() + t.type.slice(1) : '-';
            // --- Duration logic ---
            let durationValue = "-";
            let durationMinutes = null;
            if (typeof t.duration === "number") {
                durationMinutes = t.duration;
            } else if (typeof t.durationMinutes === "number" && t.durationMinutes > 0) {
                durationMinutes = t.durationMinutes;
            } else if (t.intervals && Array.isArray(t.intervals)) {
                let totalMinutes = 0;
                t.intervals.forEach(i => {
                    if (i.duration) {
                        const parts = i.duration.split(":").map(Number);
                        if (parts.length === 3) {
                            totalMinutes += parts[0] * 60 + parts[1] + parts[2] / 60;
                        } else if (parts.length === 2) {
                            totalMinutes += parts[0] + parts[1] / 60;
                        } else if (parts.length === 1) {
                            totalMinutes += parts[0];
                        }
                    }
                });
                if (totalMinutes > 0) durationMinutes = totalMinutes;
            }
            if (durationMinutes !== null) {
                durationValue = Number(durationMinutes).toFixed(2) + " min";
            }

            // --- End duration logic ---
            let distanceValue = "-";
            if (typeof t.distance === "number") {
                distanceValue = t.distance.toFixed(2);
            } else if (t.intervals && Array.isArray(t.intervals)) {
                const totalDist = t.intervals.reduce((sum, i) => sum + (parseFloat(i.distance) || 0), 0);
                distanceValue = totalDist.toFixed(2);
            }

            let gritValue = (t.gritPoints || t.gritScore || t.grit || 0).toFixed(2);

            lastTrainingsHtml += `<tr>
                <td>${type}</td>
                <td>${durationValue}</td>
                <td>${distanceValue}</td>
                <td>${gritValue}</td>
            </tr>`;
        });
        lastTrainingsHtml += "</table>";
    }
    document.getElementById('lastTrainings').innerHTML = lastTrainingsHtml;

    // Streaks
    const trainingDates = trainings.filter(t => t.date).map(t => new Date(t.date));
    const streaks = calculateStreaks(trainingDates);
    document.getElementById('currentStreak').textContent = streaks.current;

    // Leaderboard positions for each period (optional: only for self, or for all)
    const usersRef = collection(db, "users");
    const usersSnap = await getDocs(usersRef);
    let leaderboardPositions = {
        week: { rank: "-", total: "-" },
        month: { rank: "-", total: "-" },
        year: { rank: "-", total: "-" },
        allTime: { rank: "-", total: "-" }
    };

    // For each user, fetch their trainings and calculate grit for each period
    let allUsers = [];
    for (const userDoc of usersSnap.docs) {
        const userData = userDoc.data();
        const userId = userDoc.id;
        const userTrainingsRef = collection(db, "users", userId, "trainings");
        const userTrainingsSnap = await getDocs(userTrainingsRef);
        let userTrainings = [];
        userTrainingsSnap.forEach(doc => userTrainings.push(doc.data()));
        allUsers.push({
            uid: userId,
            username: userData.username || "Unknown",
            week: userTrainings.length ? sumGritForPeriod(userTrainings, "week") : 0,
            month: userTrainings.length ? sumGritForPeriod(userTrainings, "month") : 0,
            year: userTrainings.length ? sumGritForPeriod(userTrainings, "year") : 0,
            allTime: userTrainings.length ? sumGritForPeriod(userTrainings, "allTime") : 0
        });
    }

    // For each period, sort and find current user's rank
    ["week", "month", "year", "allTime"].forEach(period => {
        const sorted = allUsers.slice().sort((a, b) => b[period] - a[period]);
        const total = sorted.length;
        const myIndex = sorted.findIndex(u => u.uid === uid);
        leaderboardPositions[period] = {
            rank: myIndex >= 0 ? (myIndex + 1) : "-",
            total
        };
    });

    // Display leaderboard positions
    let leaderboardHtml = `
        <table class="leaderboard-table">
            <tr>
                <th>Period</th>
                <th>${isSelf ? "Your" : "Their"} Rank</th>
                <th>Total Users</th>
            </tr>
            <tr>
                <td>Weekly</td>
                <td>${leaderboardPositions.week.rank}</td>
                <td>${leaderboardPositions.week.total}</td>
            </tr>
            <tr>
                <td>Monthly</td>
                <td>${leaderboardPositions.month.rank}</td>
                <td>${leaderboardPositions.month.total}</td>
            </tr>
            <tr>
                <td>Yearly</td>
                <td>${leaderboardPositions.year.rank}</td>
                <td>${leaderboardPositions.year.total}</td>
            </tr>
            <tr>
                <td>All Time</td>
                <td>${leaderboardPositions.allTime.rank}</td>
                <td>${leaderboardPositions.allTime.total}</td>
            </tr>
        </table>
    `;
    document.getElementById('leaderboardPlacement').innerHTML = leaderboardHtml;
    const allTimeRankElem = document.getElementById('allTimeRank');
    if (allTimeRankElem) {
        allTimeRankElem.textContent = leaderboardPositions.allTime.rank;
    }

    // Show the upload section only for the logged-in user
    const photoUploadSection = document.getElementById('photoUploadSection');
    if (photoUploadSection) {
        if (isSelf) {
            photoUploadSection.style.display = "block";
        } else {
            photoUploadSection.style.display = "none";
        }
    }

    // Display badges
    async function displayBadges(userId) {
        const badgeDiv = document.getElementById('profileBadges');
        badgeDiv.innerHTML = ""; // Clear previous badges

        const periods = ["week", "month", "year"];
        for (const period of periods) {
            const winnerDoc = await getDoc(doc(db, "winners", period));
            if (winnerDoc.exists() && winnerDoc.data().userId === userId) {
                const img = document.createElement("img");
                img.src = `image/badge-${period}.png`;
                img.alt = `${period} winner badge`;
                img.title = `Winner (${period.charAt(0).toUpperCase() + period.slice(1)})`;
                img.style.width = "128px";
                img.style.height = "128px";
                badgeDiv.appendChild(img);
            }
        }
    }
    displayBadges(uid);
});

// --- Photo upload/cropper logic ---
document.addEventListener('DOMContentLoaded', () => {
    const photoInput = document.getElementById('photoInput');
    const changePhotoBtn = document.getElementById('changePhotoBtn');
    const userPhotoImg = document.getElementById('userPhotoImg');
    const userPhotoInitial = document.getElementById('userPhotoInitial');
    const cropperModal = document.getElementById('cropperModal');
    const cropperImage = document.getElementById('cropperImage');
    const cropperCancelBtn = document.getElementById('cropperCancelBtn');
    const cropperSaveBtn = document.getElementById('cropperSaveBtn');
    let cropper = null;

    if (changePhotoBtn && photoInput) {
        changePhotoBtn.addEventListener('click', () => {
            photoInput.click();
        });

        photoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(evt) {
                cropperImage.src = evt.target.result;
                cropperModal.style.display = "flex";
                if (cropper) cropper.destroy();
                cropper = new Cropper(cropperImage, {
                    aspectRatio: 1,
                    viewMode: 1,
                    dragMode: 'move',
                    autoCropArea: 1,
                    responsive: true,
                    background: false
                });
            };
            reader.readAsDataURL(file);
        });

        cropperCancelBtn.addEventListener('click', () => {
            cropperModal.style.display = "none";
            if (cropper) cropper.destroy();
            cropper = null;
            photoInput.value = "";
        });

        cropperSaveBtn.addEventListener('click', async () => {
            if (!cropper) return;
            cropper.getCroppedCanvas({
                width: 300,
                height: 300,
                imageSmoothingQuality: 'high'
            }).toBlob(async (blob) => {
                const user = auth.currentUser;
                if (!user) return;
                // Upload to Firebase Storage
                const storage = getStorage();
                const fileRef = storageRef(storage, `profilePhotos/${user.uid}`);
                await uploadBytes(fileRef, blob);
                const url = await getDownloadURL(fileRef);
                // Save URL to Firestore user document
                await setDoc(doc(db, "users", user.uid), { photoURL: url }, { merge: true });
                // Optionally update photo on page immediately
                userPhotoImg.src = url;
                userPhotoImg.style.display = "block";
                userPhotoInitial.style.display = "none";
                cropperModal.style.display = "none";
                cropper.destroy();
                cropper = null;
                photoInput.value = "";
                // Refresh the page to show the new photo everywhere
                window.location.reload();
            }, 'image/jpeg', 0.95);
        });
    }
});
