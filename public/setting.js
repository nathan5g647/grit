import { auth, db } from './script.js';
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

window.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('settingsForm');
    const logoutBtn = document.getElementById('logoutBtn');
    if (!form) {
        console.error('settingsForm not found in DOM!');
        return;
    }
    const originalFormHTML = form.innerHTML; // Save the original form HTML

    // Helper to fill form with data
    function fillForm(data) {
        const sex = document.getElementById('sex');
        const dob = document.getElementById('dob');
        const city = document.getElementById('city');
        const height = document.getElementById('height');
        const weight = document.getElementById('weight');
        const maxHr = document.getElementById('maxHr');
        const restHr = document.getElementById('restHr');
        const username = document.getElementById('username');
        if (sex) sex.value = data.sex || '';
        if (dob) dob.value = data.dob || '';
        if (city) city.value = data.city || '';
        if (height) height.value = data.height || '';
        if (weight) weight.value = data.weight || '';
        if (maxHr) maxHr.value = data.maxHr || '';
        if (restHr) restHr.value = data.restHr || '';
        if (username) username.value = data.username || '';
    }

    function removeButtons() {
        form.querySelectorAll("button").forEach(btn => btn.remove());
    }

    function displaySettingsAsText(data) {
        form.innerHTML = `
            <label>Username:</label> <span>${data.username || ''}</span><br>
            <label>Sex:</label> <span>${data.sex || ''}</span><br>
            <label>Date of Birth:</label> <span>${data.dob || ''}</span><br>
            <label>City:</label> <span>${data.city || ''}</span><br>
            <label>Height (cm):</label> <span>${data.height || ''}</span><br>
            <label>Weight (kg):</label> <span>${data.weight || ''}</span><br>
            <label>Max HR:</label> <span>${data.maxHr || ''}</span><br>
            <label>Rest HR:</label> <span>${data.restHr || ''}</span><br>
        `;
        addEditButton(data);
    }

    function addEditButton(data) {
        const editBtn = document.createElement('button');
        editBtn.type = "button";
        editBtn.id = "editSettings";
        editBtn.textContent = "Edit Settings";
        form.appendChild(editBtn);
        editBtn.addEventListener('click', () => {
            form.innerHTML = originalFormHTML;
            fillForm(data);
            removeButtons();
            addSaveButton();
            // Add username field as readonly
            const usernameInput = document.getElementById('username');
            if (usernameInput) {
                usernameInput.readOnly = true;
            }
        });
    }

    function addSaveButton() {
        const saveBtn = document.createElement('button');
        saveBtn.type = "submit";
        saveBtn.id = "saveSettings";
        saveBtn.textContent = "Save Settings";
        form.appendChild(saveBtn);
    }

    function normalizeName(str) {
        return str
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
            .trim()
            .toLowerCase()
            .replace(/\b\w/g, c => c.toUpperCase()); // Capitalize each word
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const docRef = doc(db, "users", user.uid, "settings", "profile");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                displaySettingsAsText(data);
            } else {
                removeButtons();
                addSaveButton();
            }
        } else {
            removeButtons();
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;
        const data = {
            username: document.getElementById('username')?.value || '', // <-- Ensure username is saved
            sex: document.getElementById('sex')?.value || '',
            dob: document.getElementById('dob')?.value || '',
            city: normalizeName(document.getElementById('city').value),
            height: document.getElementById('height') ? document.getElementById('height').value : '',
            weight: document.getElementById('weight') ? document.getElementById('weight').value : '',
            maxHr: document.getElementById('maxHr') ? document.getElementById('maxHr').value : '',
            restHr: document.getElementById('restHr') ? document.getElementById('restHr').value : ''
        };
        try {
            await setDoc(doc(db, "users", user.uid, "settings", "profile"), data, { merge: true });
            // Also save username at the root user document for global display
            if (data.username) {
                await setDoc(doc(db, "users", user.uid), { username: data.username }, { merge: true });
            }
            displaySettingsAsText(data);
        } catch (error) {
            // Optionally handle error
        }
    });

    auth.onAuthStateChanged(function(user) {
        if (logoutBtn) {
            logoutBtn.style.display = user ? 'inline-block' : 'none';
        }
    });

    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            auth.signOut().then(function() {
                window.location.href = "index.html";
            });
        });
    }

    // When rendering the form for editing, add the username field (readonly)
    form.innerHTML = form.innerHTML.replace(
        '<label for="sex">Sex:</label>',
        `<label for="username">Username:</label>
        <input type="text" id="username" name="username" readonly /><br>
        <label for="sex">Sex:</label>`
    );
});