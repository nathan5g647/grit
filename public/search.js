import { db } from './script.js';
import { collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

const searchBox = document.getElementById('searchBox');
const searchResults = document.getElementById('searchResults');

searchBox.addEventListener('input', async () => {
    const searchTerm = searchBox.value.trim();
    if (searchTerm.length === 0) {
        searchResults.innerHTML = "";
        return;
    }

    const usersRef = collection(db, "users");
    const usersSnap = await getDocs(usersRef);

    let foundUsers = [];
    for (const userDoc of usersSnap.docs) {
        const profileDocRef = doc(db, "users", userDoc.id, "settings", "profile");
        const profileDocSnap = await getDoc(profileDocRef);
        if (profileDocSnap.exists()) {
            const profileData = profileDocSnap.data();
            if (
                profileData.username &&
                profileData.username.startsWith(searchTerm) // case-sensitive prefix search
            ) {
                foundUsers.push({
                    uid: userDoc.id,
                    username: profileData.username
                });
            }
        }
    }

    if (foundUsers.length === 0) {
        searchResults.innerHTML = "<p>No users found.</p>";
        return;
    }

    let html = "<ul style='list-style:none;padding:0;'>";
    foundUsers.forEach(user => {
        html += `<li style="padding:8px 0;border-bottom:1px solid #eee;">
            <a href="profile.html?uid=${user.uid}" style="text-decoration:none;color:inherit;font-weight:bold;">
                ${user.username}
            </a>
        </li>`;
    });
    html += "</ul>";
    searchResults.innerHTML = html;
});
