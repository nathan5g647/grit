import { db } from './script.js';
import { collection, getDocs, setDoc, doc } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

const leaderboardDiv = document.getElementById('leaderboard');
const usersBtn = document.getElementById('usersBtn');
const citiesBtn = document.getElementById('citiesBtn');
const countriesBtn = document.getElementById('countriesBtn');

const PERIODS = [
    { key: "week", label: "Weekly" },
    { key: "month", label: "Monthly" },
    { key: "year", label: "Yearly" },
    { key: "allTime", label: "All Time" }
];

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
        // Get profile
        let profile = {};
        const settingsSnap = await getDocs(collection(db, "users", userId, "settings"));
        settingsSnap.forEach(doc => {
            if (doc.id === "profile") profile = doc.data();
        });

        // Get all grit scores for this user
        const gritScores = {};
        const gritSnap = await getDocs(collection(db, "users", userId, "grit"));
        gritSnap.forEach(doc => {
            gritScores[doc.id] = doc.data().score || 0;
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
            }
        });
    }
    return allUsers;
}

function getTopUsers(users, period) {
    return users
        .map(u => ({
            username: u.username,
            city: u.city,
            country: u.country,
            gritScore: u.grit[period] || 0
        }))
        .sort((a, b) => b.gritScore - a.gritScore)
        .slice(0, 5);
}

function getTopCities(users, period) {
    const cityMap = {};
    users.forEach(u => {
        if (!cityMap[u.city]) cityMap[u.city] = 0;
        cityMap[u.city] += u.grit[period] || 0;
    });
    return Object.entries(cityMap)
        .map(([city, total]) => ({ city, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
}

function getTopCountries(users, period) {
    const countryMap = {};
    users.forEach(u => {
        if (!countryMap[u.country]) countryMap[u.country] = 0;
        countryMap[u.country] += u.grit[period] || 0;
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
        html += `<tr><td>${i + 1}</td><td>${u.username}</td><td>${u.city}</td><td>${u.country}</td><td>${u.gritScore.toFixed(2)}</td></tr>`;
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

async function showCategory(category) {
    leaderboardDiv.innerHTML = "Loading...";
    const users = await fetchAllLeaderboardData();
    let html = "";
    for (const { key, label } of PERIODS) {
        if (category === "users") {
            html += renderUsersTable(getTopUsers(users, key), label, users, ""); // Pass the currentUsername as an empty string for now
        } else if (category === "cities") {
            html += renderCitiesTable(getTopCities(users, key), label, users, ""); // Pass the currentUsername as an empty string for now
        } else if (category === "countries") {
            html += renderCountriesTable(getTopCountries(users, key), label, users, ""); // Pass the currentUsername as an empty string for now
        }
    }
    leaderboardDiv.innerHTML = html;
}

// Button event listeners
usersBtn.onclick = () => showCategory("users");
citiesBtn.onclick = () => showCategory("cities");
countriesBtn.onclick = () => showCategory("countries");

// Show users by default
showCategory("users");



