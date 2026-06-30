import { db } from "./firebase-config.js";
import { collection, getDocs, doc, updateDoc, onSnapshot, query, orderBy, getDoc, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAdminStateChanged } from "./admin_security.js";

let allOrders = [];

onAdminStateChanged((user, userData) => {
    document.getElementById('adminName').textContent = userData?.username || 'Admin';
    loadOrders();
});

document.getElementById('exportXmlBtn')?.addEventListener('click', () => {
    exportOrdersToXml(allOrders);
});

// Escape special characters so values are safe inside XML
function escapeXml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// Build an XML document from the orders array and trigger a download
function exportOrdersToXml(orders) {
    if (!orders || orders.length === 0) {
        alert('No orders to export.');
        return;
    }

    const ordersXml = orders.map(order => {
        const orderId = order.id;
        const createdAtStr = order.createdAt ? new Date(order.createdAt.toDate()).toISOString() : '';

        const itemsXml = (order.items || []).map(item => `
            <item>
                <productId>${escapeXml(item.productId)}</productId>
                <name>${escapeXml(item.name)}</name>
                <quantity>${escapeXml(item.quantity)}</quantity>
                <price>${escapeXml(item.price)}</price>
            </item>`).join('');

        return `
    <order>
        <orderId>${escapeXml(orderId)}</orderId>
        <customerName>${escapeXml(order.customerName || 'Guest')}</customerName>
        <items>${itemsXml}
        </items>
        <total>${escapeXml(order.total || 0)}</total>
        <status>${escapeXml(order.status || '')}</status>
        <createdAt>${escapeXml(createdAtStr)}</createdAt>
        <paymentMethod>${escapeXml(order.paymentMethod || '')}</paymentMethod>
        <paymentProof>${escapeXml(order.paymentProof || '')}</paymentProof>
    </order>`;
    }).join('');

    const xmlString = `<?xml version="1.0" encoding="UTF-8"?>\n<orders>${ordersXml}\n</orders>`;

    const blob = new Blob([xmlString], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders_export_${new Date().toISOString().slice(0, 10)}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Load orders with real-time updates
function loadOrders() {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
        allOrders = snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
        }));
        renderOrdersTable(allOrders);
        setupSearch();
    }, (error) => {
        console.error('Error loading orders:', error);
        const tbody = document.getElementById('ordersTableBody');
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:#dc3545;">Error loading orders</td></tr>';
    });
}

// Render orders table with optional search filter
function renderOrdersTable(orders) {
    const tbody = document.getElementById('ordersTableBody');
    const orderCount = document.getElementById('orderCount');

    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:#888;">No orders found.</td></tr>';
        orderCount.textContent = '0 orders';
        return;
    }

    orderCount.textContent = orders.length + ' orders';
    tbody.innerHTML = '';

    orders.forEach((order) => {
        const orderId = order.id;

        const isCancelled = order.status === 'cancelled';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>#${orderId.slice(0, 8)}</strong></td>
            <td>${order.customerName || 'Guest'}</td>
            <td>${order.items ? order.items.length : 'N/A'} items</td>
            <td>₱${(order.total || 0).toLocaleString()}</td>
            <td>
                <select class="order-status-select" data-order-id="${orderId}" ${isCancelled ? 'disabled' : ''} style="padding:5px 10px; border-radius:4px; border:1px solid #ddd; ${isCancelled ? 'background:#f5f5f5;' : ''}">
                    <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
                    <option value="confirmed" ${order.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                    <option value="on-way" ${order.status === 'on-way' ? 'selected' : ''}>On the Way</option>
                    <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
                </select>
                ${isCancelled ? '<span style="color:#dc3545; font-weight:600; margin-left:4px;">(Cancelled)</span>' : ''}
            </td>
            <td>${order.createdAt ? new Date(order.createdAt.toDate()).toLocaleDateString() : 'N/A'}</td>
            <td>
                ${order.paymentProof ? `<img src="${order.paymentProof}" alt="Proof of Payment" style="width:50px; height:50px; object-fit:cover; border-radius:4px; border:1px solid #ddd; cursor:pointer;" onclick="openProofModal('${order.paymentProof.replace(/'/g, "\\'")}')" title="View proof of payment">` : '<span style="color:#888;">None</span>'}
            </td>
            <td>
                <button class="btn btn-sm view-details-btn" data-order-id="${orderId}" style="background:#7c6c3f; color:white; border:none; padding:5px 12px; border-radius:4px; cursor:pointer;">View</button>
            </td>
            <td>
                <button class="btn btn-success btn-sm update-status-btn" data-order-id="${orderId}" ${isCancelled ? 'disabled' : ''} style="${isCancelled ? 'background:#aaa; cursor:not-allowed;' : ''}">Update</button>
                ${order.status !== 'cancelled' && order.status !== 'delivered' ? `<button class="btn btn-sm cancel-order-btn" data-order-id="${orderId}" style="background:#dc3545; color:white; border:none; padding:5px 12px; border-radius:4px; cursor:pointer; margin-left:4px;">Cancel</button>` : ''}
            </td>
        `;
        tbody.appendChild(tr);

        tr.querySelector('.view-details-btn')?.addEventListener('click', () => {
            window.openOrderDetailsModal({
                ...order,
                orderId: orderId
            });
        });
    });

    // Attach handlers after rendering
    attachCancelHandlers();
    attachStatusHandlers();
}

// Attach cancel order button handlers
function attachCancelHandlers() {
    document.querySelectorAll('.cancel-order-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const orderId = btn.dataset.orderId;
            if (!confirm('Are you sure you want to cancel this order? This will restore the item stock.')) return;

            const btnEl = document.querySelector(`.cancel-order-btn[data-order-id="${orderId}"]`);
            if (btnEl) {
                btnEl.disabled = true;
                btnEl.textContent = 'Cancelling...';
            }

            try {
                const orderRef = doc(db, "orders", orderId);
                const orderSnap = await getDoc(orderRef);
                if (!orderSnap.exists()) {
                    alert('Order not found.');
                    return;
                }

                const orderData = orderSnap.data();
                const batch = writeBatch(db);

                batch.update(orderRef, {
                    status: 'cancelled',
                    updatedAt: serverTimestamp()
                });

                const items = orderData.items || [];
                const validItems = items.filter(item => item.productId);

                if (validItems.length > 0) {
                    const productSnaps = await getDocs(collection(db, "products"));

                    const productMap = {};
                    productSnaps.forEach(docSnap => {
                        productMap[docSnap.id] = docSnap.data();
                    });

                    validItems.forEach(item => {
                        const productData = productMap[item.productId];
                        if (productData) {
                            const currentStock = productData.stock || 0;
                            const qty = item.quantity || 1;
                            batch.update(doc(db, "products", item.productId), {
                                stock: currentStock + qty
                            });
                        }
                    });
                }

                await batch.commit();
                alert('Order cancelled successfully. Stock has been restored.');

            } catch (error) {
                console.error('Error cancelling order:', error);
                alert('Error cancelling order: ' + error.message);
            }
        });
    });
}

// Attach status update handlers
function attachStatusHandlers() {
    document.querySelectorAll('.update-status-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const orderId = btn.dataset.orderId;
            const select = document.querySelector(`.order-status-select[data-order-id="${orderId}"]`);
            const newStatus = select.value;

            try {
                await updateDoc(doc(db, "orders", orderId), {
                    status: newStatus,
                    updatedAt: serverTimestamp()
                });
                alert('Order status updated successfully!');
            } catch (error) {
                alert('Error updating order: ' + error.message);
            }
        });
    });
}

// Search functionality
function setupSearch() {
    const searchInput = document.getElementById('orderSearch');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const term = searchInput.value.toLowerCase();
            if (!term) {
                renderOrdersTable(allOrders);
                return;
            }
            
            const filtered = allOrders.filter(order => {
                const orderId = order.id.slice(0, 8).toLowerCase();
                const customerName = (order.customerName || '').toLowerCase();
                const formattedDate = order.createdAt ? new Date(order.createdAt.toDate()).toLocaleDateString().toLowerCase() : '';
                const paymentMethod = (order.paymentMethod || '').toLowerCase();
                const total = (order.total || 0).toLocaleString().toLowerCase();
                const status = (order.status || '').toLowerCase();

                return (
                    orderId.includes(term) ||
                    customerName.includes(term) ||
                    formattedDate.includes(term) ||
                    paymentMethod.includes(term) ||
                    total.includes(term) ||
                    status.includes(term)
                );
            });
            renderOrdersTable(filtered);
        });
    }
}