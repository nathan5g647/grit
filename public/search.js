import { db } from './script.js';
import { collection, query, orderBy, startAt, endAt, limit, getDocs } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

const searchBox = document.getElementById('searchBox');
const searchResults = document.getElementById('searchResults');

searchBox.addEventListener('input', async () => {
    const searchTerm = searchBox.value.trim().toLowerCase();
    if (searchTerm.length === 0) {
        searchResults.innerHTML = "";
        return;
    }

    // Firestore query: usernames are stored in lowercase for best results
    const usersRef = collection(db, "users");
    const q = query(
        usersRef,
        orderBy("username"),
        startAt(searchTerm),
        endAt(searchTerm + '\uf8ff'),
        limit(10)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
        searchResults.innerHTML = "<p>No users found.</p>";
        return;
    }

    let html = "<ul style='list-style:none;padding:0;'>";
    snap.forEach(doc => {
        const data = doc.data();
        // Link to profile page, assuming you use profile.html?uid=USER_ID
        html += `<li style="padding:8px 0;border-bottom:1px solid #eee;">
            <a href="profile.html?uid=${doc.id}" style="text-decoration:none;color:inherit;font-weight:bold;">
                ${data.username}
            </a>
        </li>`;
    });
    html += "</ul>";
    searchResults.innerHTML = html;
});