import { db } from "./firebase-config.js";
import { auth } from "./firebase-config.js";
import {
    collection,
    query,
    where,
    onSnapshot,
    orderBy,
    updateDoc,
    doc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

let userOrders = [];

function getStatusClass(status) {
    switch (status) {
        case 'pending': return 'pending';
        case 'confirmed': return 'confirmed';
        case 'on-way': return 'on-way';
        case 'delivered': return 'delivered';
        case 'cancelled': return 'cancelled';
        default: return 'pending';
    }
}

function getProgressSteps(status) {
    const steps = ['Order Placed', 'Confirmed', 'On the Way', 'Received'];
    let statusIndex = -1;
    switch (status) {
        case 'pending': statusIndex = 0; break;
        case 'confirmed': statusIndex = 1; break;
        case 'on-way': statusIndex = 2; break;
        case 'delivered': statusIndex = 3; break;
        case 'cancelled': statusIndex = -1; break;
    }
    return steps.map((step, index) => {
        if (status === 'cancelled') {
            return `<div class="step cancelled">${step}</div>`;
        }
        if (index <= statusIndex) {
            return `<div class="step active">${step}</div>`;
        }
        return `<div class="step">${step}</div>`;
    }).join('');
}

function getStatusLabel(status) {
    switch (status) {
        case 'pending': return 'Pending';
        case 'confirmed': return 'Confirmed';
        case 'on-way': return 'On the Way';
        case 'delivered': return 'Delivered';
        case 'cancelled': return 'Cancelled';
        default: return 'Pending';
    }
}

function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function uploadPaymentProof(orderId, file) {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
        const proofImage = await readFileAsDataURL(file);
        await updateDoc(doc(db, "orders", orderId), {
            paymentProof: proofImage
        });
        showMessage("Proof uploaded successfully!", "success");
        setTimeout(hideMessage, 3000);
    } catch (error) {
        console.error("Error uploading proof:", error);
        showMessage("Failed to upload proof: " + error.message, "error");
    }
}

function renderOrderCard(order) {
    const statusClass = getStatusClass(order.status);
    const statusLabel = getStatusLabel(order.status);
    const canEditProof = order.status === 'pending';

    const itemsList = (order.items || []).map(item => `
        <div class="order-item">
            ${item.image ? `<img src="${item.image}" alt="${item.name}" />` : ''}
            <div class="order-item-info">
                <p class="order-item-name">${item.name || 'Unknown Item'}</p>
                <p class="order-item-qty">Qty: ${item.quantity || 1} × ₱${(item.price || 0).toLocaleString()}</p>
            </div>
        </div>
    `).join('');

    const proofSection = order.paymentProof ? `
        <div class="proof-section">
            <strong>Proof of Payment:</strong>
            <img src="${order.paymentProof}" class="proof-img" title="Click to enlarge" onclick="window.openProofModal && window.openProofModal('${order.paymentProof.replace(/'/g, "\\'")}')" />
        </div>
    ` : '';

    const adminCommentSection = order.adminComment ? `
        <div class="admin-comment-section">
            <strong>Admin Note:</strong>
            <p class="admin-comment-text">${escapeHtml(order.adminComment)}</p>
        </div>
    ` : '';

    const uploadProofButton = canEditProof ? `
        <div class="proof-upload-section">
            <button class="upload-proof-btn" onclick="window.showUploadProofModal && window.showUploadProofModal('${order.id}')">
                ${order.paymentProof ? 'Replace Proof of Payment' : 'Upload Proof of Payment'}
            </button>
        </div>
    ` : '';

    return `
        <div class="order-card">
            <div class="order-header">
                <div>
                    <h2>Order #${order.id.slice(0, 8)}</h2>
                    <p>Date Ordered: ${formatDate(order.createdAt)}</p>
                </div>
                <span class="status ${statusClass}">${statusLabel}</span>
            </div>

            <div class="order-content">
                <div class="order-items">
                    ${itemsList || '<p>No items</p>'}
                </div>
                ${order.label ? `<p><strong>Label:</strong> ${order.label.toUpperCase()}</p>` : ''}
                <p><strong>Total Items:</strong> ₱${(order.subtotal || 0).toLocaleString()}</p>
                ${order.shippingFee > 0 ? `<p><strong>Shipping Fee (Cash on Delivery):</strong> ₱${order.shippingFee.toLocaleString()}</p>` : ''}
                <p><strong>Total Due:</strong> ₱${((order.subtotal || 0) + (order.shippingFee || 0)).toLocaleString()}</p>
                <p><strong>Payment Method:</strong> ${order.paymentMethod || 'N/A'}</p>
                <p><strong>Delivery Address:</strong> ${order.address || 'N/A'}</p>
                <p><strong>Contact:</strong> ${order.contact || 'N/A'}</p>
                ${proofSection}
                ${adminCommentSection}
                ${uploadProofButton}
                ${order.trackingInfo ? `
                    <div class="tracking-info-section">
                        <strong>Delivery Tracking:</strong>
                        <p class="tracking-info-text">${escapeHtml(order.trackingInfo)}</p>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

function renderOrders(orders, searchTerm = '') {
    const ordersSection = document.querySelector('.orders-section');
    if (!ordersSection) return;

    // Remove existing order cards but keep search bar
    const existingCards = document.querySelectorAll('.order-card');
    existingCards.forEach(card => card.remove());
    
    // Remove existing empty state
    const existingEmptyState = document.querySelector('.empty-orders');
    if (existingEmptyState) existingEmptyState.remove();

    // Remove existing orders container
    const existingOrdersContainer = document.getElementById('ordersContainer');
    if (existingOrdersContainer) existingOrdersContainer.remove();

    let filteredOrders = orders;
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filteredOrders = orders.filter(order => {
            const orderId = order.id.slice(0, 8).toLowerCase();
            const customerName = (order.customerName || '').toLowerCase();
            const formattedDate = formatDate(order.createdAt).toLowerCase();
            const paymentMethod = (order.paymentMethod || '').toLowerCase();
            const total = (order.total || 0).toLocaleString();

            return (
                orderId.includes(term) ||
                customerName.includes(term) ||
                formattedDate.includes(term) ||
                paymentMethod.includes(term) ||
                total.includes(term)
            );
        });
    }

    if (filteredOrders.length === 0 && searchTerm) {
        // Just show "No orders found" message without replacing search bar
        const container = document.createElement('div');
        container.id = 'ordersContainer';
        container.innerHTML = `
            <div class="empty-orders">
                <p>No orders found matching "${escapeHtml(searchTerm)}".</p>
            </div>
        `;
        ordersSection.appendChild(container);
        return;
    }

    const cardsHtml = filteredOrders.map(order => renderOrderCard(order)).join('');

    const container = document.createElement('div');
    container.id = 'ordersContainer';
    container.innerHTML = cardsHtml;
    ordersSection.appendChild(container);
}

// Setup search handlers
function setupSearchHandlers() {
    const searchInput = document.getElementById('searchOrderInput');
    const searchBtn = document.getElementById('searchOrderBtn');

    if (searchInput && searchBtn) {
        // Remove any existing listeners to avoid duplicates
        searchBtn.replaceWith(searchBtn.cloneNode(true));
        const newSearchBtn = document.getElementById('searchOrderBtn');
        
        newSearchBtn.addEventListener('click', () => {
            renderOrders(userOrders, searchInput.value.trim());
        });
        searchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                renderOrders(userOrders, searchInput.value.trim());
            }
        });
    }
}

function loadOrders() {
    const user = auth.currentUser;
    if (!user) {
        const ordersSection = document.querySelector('.orders-section');
        if (ordersSection) {
            ordersSection.innerHTML = `
                <h1>Order Tracking</h1>
                <p class="orders-description">View your order history and check the current status of your purchases.</p>
                <div class="empty-orders">
                    <p>Please login to view your orders.</p>
                    <a href="login.html" class="shop-now-btn">Login</a>
                </div>
            `;
        }
        return;
    }

    const ordersRef = collection(db, "orders");

    const q = query(
        ordersRef,
        where("customerId", "==", user.uid),
        orderBy("createdAt", "desc")
    );

    return onSnapshot(q, (snapshot) => {
        userOrders = snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
        }));
        renderOrders(userOrders);
        setupSearchHandlers();
    }, (error) => {
        console.error('Error loading orders:', error);
        const ordersSection = document.querySelector('.orders-section');
        if (ordersSection) {
            ordersSection.innerHTML = `
                <h1>Order Tracking</h1>
                <p class="orders-description">View your order history and check the current status of your purchases.</p>
                <div class="empty-orders">
                    <p>Error loading orders. Please try again later.</p>
                </div>
            `;
        }
    });
}

// Upload proof modal functions
let currentOrderIdForUpload = null;

window.showUploadProofModal = function(orderId) {
    currentOrderIdForUpload = orderId;
    const modal = document.getElementById('uploadProofModal');
    const fileInput = document.getElementById('proofUploadInput');
    if (modal) {
        modal.style.display = 'flex';
    }
    if (fileInput) {
        fileInput.value = '';
    }
};

window.closeUploadProofModal = function() {
    const modal = document.getElementById('uploadProofModal');
    if (modal) {
        modal.style.display = 'none';
    }
    currentOrderIdForUpload = null;
};

window.submitPaymentProof = async function() {
    const fileInput = document.getElementById('proofUploadInput');
    if (fileInput && fileInput.files[0] && currentOrderIdForUpload) {
        await uploadPaymentProof(currentOrderIdForUpload, fileInput.files[0]);
        window.closeUploadProofModal();
    } else {
        showMessage("Please select a file first.", "error");
    }
};

// Proof modal for customer view
window.openProofModal = function(imageSrc) {
    const modal = document.getElementById('proofModal');
    const modalImg = document.getElementById('proofModalImage');
    if (modal && modalImg) {
        modalImg.src = imageSrc;
        modal.style.display = 'flex';
    }
};

// ==================== LOGOUT ====================
window.logout = async function() {
    try {
        await signOut(auth);
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Error logging out:', error);
    }
};

onAuthStateChanged(auth, (user) => {
    if (user) {
        loadOrders();
    } else {
        const ordersSection = document.querySelector('.orders-section');
        if (ordersSection) {
            ordersSection.innerHTML = `
                <h1>Order Tracking</h1>
                <p class="orders-description">View your order history and check the current status of your purchases.</p>
                <div class="empty-orders">
                    <p>Please login to view your orders.</p>
                    <a href="login.html" class="shop-now-btn">Login</a>
                </div>
            `;
        }
    }
    
    // Redirect after brief delay to allow message to render if needed
    if (!user) {
        setTimeout(() => {
            window.location.replace('login.html');
        }, 100);
    }
});