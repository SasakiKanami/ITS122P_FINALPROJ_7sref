import { db } from "./firebase-config.js";
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAdminStateChanged } from "./admin_security.js";

onAdminStateChanged((user, userData) => {
    document.getElementById('adminName').textContent = userData?.username || 'Admin';
    loadUsers();
});

// ==================== LOAD USERS ====================
async function loadUsers() {
    try {
        const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);

        const tbody = document.getElementById('usersTableBody');
        const userCount = document.getElementById('userCount');

        userCount.textContent = snapshot.size + ' users';

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#888;">No users yet</td></tr>';
            return;
        }

        tbody.innerHTML = '';

        snapshot.forEach(docSnap => {
            const user = docSnap.data();
            const isAdmin = user.isAdmin === true;
            const role = isAdmin ? 'Admin' : 'Customer';
            const roleColor = isAdmin ? '#5c491f' : '#3a382f';
            const roleBg = isAdmin ? '#e2d7c3' : '#f0f0f0';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="
                            width: 35px;
                            height: 35px;
                            border-radius: 50%;
                            background: #7c6c3f;
                            color: #fffef8;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-weight: 700;
                            font-size: 14px;
                        ">${(user.username || 'U')[0].toUpperCase()}</div>
                        <strong>${user.username || 'N/A'}</strong>
                    </div>
                </td>
                <td>${user.email || 'N/A'}</td>
                <td>${user.createdAt ? new Date(user.createdAt.toDate()).toLocaleDateString() : 'N/A'}</td>
                <td>
                    <span style="
                        padding: 4px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                        font-weight: 600;
                        background: ${roleBg};
                        color: ${roleColor};
                    ">${role}</span>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error('Error loading users:', error);
    }
}