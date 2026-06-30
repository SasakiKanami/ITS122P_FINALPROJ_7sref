import { auth, db } from "./firebase-config.js";
import { collection, getDocs, doc, getDoc, query, orderBy, limit, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAdminStateChanged } from "./admin_security.js";

onAdminStateChanged((user, userData) => {
    document.getElementById('adminName').textContent = userData?.username || 'Admin';
    loadDashboardData();
});

// ==================== LOAD DASHBOARD ====================
async function loadDashboardData() {
    try {
        // Get products count
        const productsSnapshot = await getDocs(collection(db, "products"));
        document.getElementById('totalProducts').textContent = productsSnapshot.size;

        // Get orders count and total revenue
        const ordersSnapshot = await getDocs(collection(db, "orders"));
        
        let totalRevenue = 0;
        let totalOrdersCount = 0;
        let deliveredOrdersCount = 0;
        
        ordersSnapshot.forEach(doc => {
            const order = doc.data();
            // Count all non-cancelled orders
            if (order.status !== 'cancelled') {
                totalOrdersCount++;
            }
            // Only count delivered orders for revenue (actual sales)
            if (order.status === 'delivered') {
                deliveredOrdersCount++;
                totalRevenue += order.total || 0;
            }
        });
        
        document.getElementById('totalOrders').textContent = totalOrdersCount;
        document.getElementById('totalRevenue').textContent = '₱' + totalRevenue.toLocaleString();

        // Get users count
        const usersSnapshot = await getDocs(collection(db, "users"));
        document.getElementById('totalUsers').textContent = usersSnapshot.size;

        // ==================== RECENT ORDERS ====================
        const ordersQuery = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(5));
        const recentOrdersSnapshot = await getDocs(ordersQuery);
        const ordersBody = document.getElementById('recentOrders');

        if (recentOrdersSnapshot.empty) {
            ordersBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#888;">No orders yet</td></tr>';
        } else {
            ordersBody.innerHTML = '';
            recentOrdersSnapshot.forEach(doc => {
                const order = doc.data();
                const statusClass = order.status === 'pending' ? 'pending' :
                                    order.status === 'on-way' ? 'active' : 'inactive';
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>#${doc.id.slice(0, 8)}</td>
                    <td>${order.customerName || 'Guest'}</td>
                    <td>₱${(order.total || 0).toLocaleString()}</td>
                    <td><span class="badge-status ${statusClass}">${order.status || 'pending'}</span></td>
                    <td>${order.createdAt ? new Date(order.createdAt.toDate()).toLocaleDateString() : 'N/A'}</td>
                `;
                ordersBody.appendChild(tr);
            });
        }

        // ==================== LOW STOCK PRODUCTS ====================
        const lowStockQuery = query(collection(db, "products"), where("stock", "<=", 5));
        const lowStockSnapshot = await getDocs(lowStockQuery);
        const lowStockBody = document.getElementById('lowStockProducts');

        if (lowStockSnapshot.empty) {
            lowStockBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#888;">No low stock products</td></tr>';
        } else {
            lowStockBody.innerHTML = '';
            lowStockSnapshot.forEach(doc => {
                const product = doc.data();
                const tr = document.createElement('tr');
                const statusClass = product.stock > 0 ? 'active' : 'inactive';
                const statusText = product.stock > 0 ? 'In Stock' : 'Out of Stock';
                tr.innerHTML = `
                    <td>
                        ${product.image
                            ? `<img src="${product.image}" class="product-img" alt="${product.name}" onerror="this.style.display='none'">`
                            : `<div class="product-img" style="background:#f0ebe0; display:flex; align-items:center; justify-content:center; font-size:11px; color:#aaa;">No Image</div>`}
                    </td>
                    <td>${product.name}</td>
                    <td>₱${(product.price || 0).toLocaleString()}</td>
                    <td style="color:${product.stock <= 2 ? '#dc3545' : '#ffc107'}; font-weight:600;">${product.stock || 0}</td>
                    <td><span class="badge-status ${statusClass}">${statusText}</span></td>
                `;
                lowStockBody.appendChild(tr);
            });
        }

    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}