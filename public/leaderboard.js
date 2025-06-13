import { db } from './script.js';
import { collection, getDocs, setDoc, doc } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

const leaderboardDiv = document.getElementById('leaderboard');
const usersBtn = document.getElementById('usersBtn');
const citiesBtn = document.getElementById('citiesBtn');
const countriesBtn = document.getElementById('countriesBtn');

const ADMIN_UID = "FN8mLsCXjXPHdd7AYuK06JJNHiw1"; // <-- Replace with your admin UID

function isAdmin() {
    const auth = getAuth();
    return auth.currentUser && auth.currentUser.uid === ADMIN_UID;
}

const PERIODS = [
    { key: "week", label: "Weekly" },
    { key: "month", label: "Monthly" },
    { key: "year", label: "Yearly" },
    { key: "allTime", label: "All Time" }
];
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
    return new Date(2000, 0, 1);
}

function normalize(str) {
    if (!str) return "Unknown";
    str = str.trim();
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

async function fetchAllLeaderboardData() {
    const usersSnap = await getDocs(collection(db, "users"));
    const allUsers = [];

    for (const userDoc of usersSnap.docs) {
        const userId = userDoc.id;
        let profile = {};
        const settingsSnap = await getDocs(collection(db, "users", userId, "settings"));
        settingsSnap.forEach(doc => {
            if (doc.id === "profile") profile = doc.data();
        });

        const gritScores = {};
        const gritSnap = await getDocs(collection(db, "users", userId, "grit"));
        gritSnap.forEach(doc => {
            gritScores[doc.id] = doc.data().score || 0;
        });

        const trainingsSnap = await getDocs(collection(db, "users", userId, "trainings"));
        const trainings = [];
        trainingsSnap.forEach(doc => {
            trainings.push({ id: doc.id, ...doc.data() });
        });

        allUsers.push({
            userId,
            username: normalize(profile.username) || userId,
            city: normalize(profile.city),
            country: normalize(profile.country),
            grit: {
                week: gritScores.week || 0,
                month: gritScores.month || 0,
                year: gritScores.year || 0,
                allTime: gritScores.allTime || 0
            },
            trainings
        });
    }
    return allUsers;
}

function getTopUsers(users, period) {
    return users
        .map(u => ({
            userId: u.userId, // <-- Add this line!
            username: u.username,
            city: u.city,
            country: u.country,
            gritScore: sumGritForPeriod(u.trainings, period)
        }))
        .sort((a, b) => b.gritScore - a.gritScore)
        .slice(0, 5);
}

function getTopCities(users, period) {
    const cityMap = {};
    users.forEach(u => {
        const city = u.city;
        if (!cityMap[city]) cityMap[city] = 0;
        cityMap[city] += sumGritForPeriod(u.trainings, period);
    });
    return Object.entries(cityMap)
        .map(([city, total]) => ({ city, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
}

function getTopCountries(users, period) {
    const countryMap = {};
    users.forEach(u => {
        const country = u.country;
        if (!countryMap[country]) countryMap[country] = 0;
        countryMap[country] += sumGritForPeriod(u.trainings, period);
    });
    return Object.entries(countryMap)
        .map(([country, total]) => ({ country, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
}

function renderUsersTable(users, periodLabel, allUsers, currentUsername) {
    let html = `<h3>${periodLabel} - Top 5 Users</h3>`;
    html += "<table border='1'><tr><th>Rank</th><th>Username</th><th>City</th><th>Country</th><th>GRIT Score</th></tr>";
    users.forEach((u, i) => {
        html += `<tr>
            <td>${i + 1}</td>
            <td>
                <a href="profile.html?uid=${u.userId}" style="text-decoration:none;color:inherit;font-weight:bold;">
                    ${u.username}
                </a>
            </td>
            <td>${u.city}</td>
            <td>${u.country}</td>
            <td>${u.gritScore.toFixed(2)}</td>
        </tr>`;
    });
    html += "</table>";

    // Find current user's rank in allUsers
    if (currentUsername) {
        const sorted = allUsers
            .map(u => ({
                username: u.username,
                city: u.city,
                country: u.country,
                gritScore: u.grit[periodLabel.toLowerCase().replace(' ', '')] || 0
            }))
            .sort((a, b) => b.gritScore - a.gritScore);

        const userIndex = sorted.findIndex(u => u.username === currentUsername);
        if (userIndex >= 5) {
            const u = sorted[userIndex];
            // Normalize username, city, and country for display
            const norm = s => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "Unknown";
            html += `<div style="margin-top:10px;"><b>Your Rank:</b> ${userIndex + 1} | <b>${norm(u.username)}</b> (${norm(u.city)}, ${norm(u.country)}) - <b>${u.gritScore.toFixed(2)}</b></div>`;
        }
    }
    return html;
}

function renderCitiesTable(cities, periodLabel, allUsers, currentUsername) {
    let html = `<h3>${periodLabel} - Top 5 Cities</h3>`;
    html += "<table border='1'><tr><th>Rank</th><th>City</th><th>Total GRIT Points</th></tr>";
    cities.forEach(({ city, total }, i) => {
        html += `<tr><td>${i + 1}</td><td>${city}</td><td>${total.toFixed(2)}</td></tr>`;
    });
    html += "</table>";

    // Show current user's city rank if not in top 5
    if (currentUsername) {
        // Find the user's city
        const user = allUsers.find(u => u.username === currentUsername);
        if (user) {
            // Get all cities sorted by total GRIT
            const cityMap = {};
            allUsers.forEach(u => {
                const c = u.city;
                cityMap[c] = (cityMap[c] || 0) + (u.grit[periodLabel.toLowerCase().replace(' ', '')] || 0);
            });
            const sortedCities = Object.entries(cityMap)
                .map(([city, total]) => ({ city, total }))
                .sort((a, b) => b.total - a.total);
            const cityIndex = sortedCities.findIndex(c => c.city === user.city);
            if (cityIndex >= 5) {
                html += `<div style="margin-top:10px;"><b>Your City Rank:</b> ${cityIndex + 1} | <b>${user.city.charAt(0).toUpperCase() + user.city.slice(1).toLowerCase()}</b> - <b>${sortedCities[cityIndex].total.toFixed(2)}</b></div>`;
            }
        }
    }
    return html;
}

function renderCountriesTable(countries, periodLabel, allUsers, currentUsername) {
    let html = `<h3>${periodLabel} - Top 5 Countries</h3>`;
    html += "<table border='1'><tr><th>Rank</th><th>Country</th><th>Total GRIT Points</th></tr>";
    countries.forEach(({ country, total }, i) => {
        html += `<tr><td>${i + 1}</td><td>${country}</td><td>${total.toFixed(2)}</td></tr>`;
    });
    html += "</table>";

    // Show current user's country rank if not in top 5
    if (currentUsername) {
        // Find the user's country
        const user = allUsers.find(u => u.username === currentUsername);
        if (user) {
            // Get all countries sorted by total GRIT
            const countryMap = {};
            allUsers.forEach(u => {
                const c = u.country;
                countryMap[c] = (countryMap[c] || 0) + (u.grit[periodLabel.toLowerCase().replace(' ', '')] || 0);
            });
            const sortedCountries = Object.entries(countryMap)
                .map(([country, total]) => ({ country, total }))
                .sort((a, b) => b.total - a.total);
            const countryIndex = sortedCountries.findIndex(c => c.country === user.country);
            if (countryIndex >= 5) {
                html += `<div style="margin-top:10px;"><b>Your Country Rank:</b> ${countryIndex + 1} | <b>${user.country.charAt(0).toUpperCase() + user.country.slice(1).toLowerCase()}</b> - <b>${sortedCountries[countryIndex].total.toFixed(2)}</b></div>`;
            }
        }
    }
    return html;
}

function sumGritForPeriod(trainings, period) {
    if (period === "allTime") {
        return trainings.reduce((sum, t) => sum + (t.gritPoints || t.gritScore || t.grit || 0), 0);
    }
    const periodStart = getPeriodStart(period);
    return trainings
        .filter(t => {
            // Prefer t.date, fallback to t.createdAt
            const dateStr = t.date || t.createdAt;
            if (!dateStr) return false;
            const d = new Date(dateStr);
            return d >= periodStart;
        })
        .reduce((sum, t) => sum + (t.gritPoints || t.gritScore || t.grit || 0), 0);
}

async function showCategory(category) {
    leaderboardDiv.innerHTML = "Loading...";
    const users = await fetchAllLeaderboardData();
    let html = "";
    if (category === "users") {
        for (const { key, label } of PERIODS) {
            html += renderUsersTable(getTopUsers(users, key), label, users, "");
        }
    } else if (category === "cities") {
        for (const { key, label } of PERIODS) {
            html += renderCitiesTable(getTopCities(users, key), label, users, "");
        }
    } else if (category === "countries") {
        for (const { key, label } of PERIODS) {
            html += renderCountriesTable(getTopCountries(users, key), label, users, "");
        }
    }
    leaderboardDiv.innerHTML = html;
}

// Button event listeners
usersBtn.onclick = () => showCategory("users");
citiesBtn.onclick = () => showCategory("cities");
countriesBtn.onclick = () => showCategory("countries");

// Show user leaderboard by default on page load
showCategory("users");

// Save the winner for a period in a separate "winners" collection in Firestore (not in users)
async function saveLastWinner(period, users) {
    if (!users || users.length === 0) return;
    // Find the user with the highest gritScore for this period
    const sorted = users
        .map(u => ({
            userId: u.userId,
            username: u.username,
            city: u.city,
            country: u.country,
            gritScore: sumGritForPeriod(u.trainings, period)
        }))
        .sort((a, b) => b.gritScore - a.gritScore);

    const winner = sorted[0];
    if (!winner || winner.gritScore <= 0) return;

    // Save/overwrite the winner in a separate "winners" collection at winners/{period}
    await setDoc(doc(db, "winners", period), {
        userId: winner.userId,
        username: winner.username,
        city: winner.city,
        country: winner.country,
        gritScore: winner.gritScore,
        timestamp: new Date()
    });
}

// After fetching all users
async function adminSaveWinnersIfAdmin() {
    const users = await fetchAllLeaderboardData();
    if (isAdmin()) {
        await saveLastWinner("week", users);
        await saveLastWinner("month", users);
        await saveLastWinner("year", users);
        await saveLastWinner("allTime", users);
    }
}

// DO NOT call adminSaveWinnersIfAdmin() automatically!
// Only expose it for the admin user after authentication.

const auth = getAuth();
onAuthStateChanged(auth, (user) => {
  if (user && user.uid === ADMIN_UID) {
    window.adminSaveWinnersIfAdmin = adminSaveWinnersIfAdmin;
  }
});

// For debugging UID
window.showMyUid = () => {
  import('https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js').then(({ getAuth }) => {
    alert(getAuth().currentUser && getAuth().currentUser.uid);
  });
};



