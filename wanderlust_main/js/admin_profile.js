import { db } from "./firebase-config.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAdminStateChanged } from "./admin_security.js";

onAdminStateChanged((user, userData) => {
    document.getElementById('adminEmail').value = user.email || '';
    document.getElementById('adminDisplayName').value = userData?.username || '';
    document.getElementById('adminName').textContent = userData?.username || 'Admin';
    document.getElementById('adminAvatar').textContent = (userData?.username || 'A')[0].toUpperCase();

    // ==================== UPDATE PROFILE ====================
    document.getElementById('updateProfileBtn').addEventListener('click', async () => { 
        const newName = document.getElementById('adminDisplayName').value.trim();
        const profileMessage = document.getElementById('profileMessage');

        if (!newName) {
            profileMessage.style.color = '#dc3545';
            profileMessage.textContent = 'Display name cannot be empty.';
            return;
        }

        try {
            await updateDoc(doc(db, "users", user.uid), {
                username: newName
            });

            document.getElementById('adminName').textContent = newName;
            document.getElementById('adminAvatar').textContent = newName[0].toUpperCase();
            sessionStorage.setItem('adminName', newName);

            profileMessage.style.color = '#28a745';
            profileMessage.textContent = 'Profile updated successfully!';

        } catch (error) {
            profileMessage.style.color = '#dc3545';
            profileMessage.textContent = 'Error updating profile: ' + error.message;
        }
    });
});