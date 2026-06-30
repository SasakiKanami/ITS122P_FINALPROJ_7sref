import { db } from "./firebase-config.js";
import { auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
    doc,
    getDoc,
    collection,
    query,
    where,
    getDocs,
    deleteDoc,
    updateDoc,
    orderBy,
    serverTimestamp,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let iti = null;
let currentCartItems = [];
let selectedAddressId = null;
let currentUserProfile = null;
let adminPaymentMethods = [];

function showMessage(message, type = 'error') {
    const msgDiv = document.getElementById('checkoutMessage');
    msgDiv.textContent = message;
    msgDiv.className = `checkout-message ${type}`;
    msgDiv.style.display = 'block';
}

function hideMessage() {
    const msgDiv = document.getElementById('checkoutMessage');
    msgDiv.style.display = 'none';
}

async function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function formatAddress(addr) {
    const parts = [
        addr.street,
        addr.city,
        addr.province,
        addr.zip,
        addr.country
    ].filter(Boolean);
    return parts.join(', ');
}

function formatRecipientName(addr) {
    if (!addr.recipientFirstName) return null;
    const parts = [addr.recipientFirstName, addr.recipientMiddleName, addr.recipientLastName].filter(Boolean);
    return parts.join(' ');
}

function formatTime12(time) {
    if (!time) return '';
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function renderAddressCard(addr, isSelected) {
    const recipientName = formatRecipientName(addr);
    const buyerName = currentUserProfile?.firstName || '';
    const displayName = recipientName || buyerName;
    const label = addr.label ? addr.label.toUpperCase() : '';
    const timeRange = addr.availableTimeStart
        ? `${formatTime12(addr.availableTimeStart)}${addr.availableTimeEnd ? ' - ' + formatTime12(addr.availableTimeEnd) : ''}`
        : '';
    const phone = addr.recipientContact || currentUserProfile?.contact || '';

    return `
        <div class="address-card ${isSelected ? 'selected' : ''}" data-id="${addr.id}" style="
            background: #fffef8;
            border: 2px solid ${isSelected ? '#5c491f' : '#dad6c2'};
            border-radius: 8px;
            padding: 15px;
            cursor: pointer;
            transition: all 0.3s;
            position: relative;
        ">
            ${addr.isDefault ? `<span style="
                background: #7c6c3f;
                color: #fffef8;
                font-size: 11px;
                padding: 2px 8px;
                border-radius: 10px;
                font-weight: 600;
                margin-bottom: 6px;
                display: inline-block;
            ">Default</span>` : ''}
            ${label ? `<span style="
                background: #e2d7c3;
                color: #5c491f;
                font-size: 11px;
                padding: 2px 8px;
                border-radius: 10px;
                font-weight: 600;
                margin-bottom: 6px;
                display: inline-block;
                margin-left: 4px;
            ">${label}</span>` : ''}
            ${displayName ? `<p style="font-weight:700; color:#5c491f; margin-bottom:3px;">${recipientName ? ' Recipient: ' : ''}${displayName}</p>` : ''}
            ${phone ? `<p style="color:#797259; margin-bottom:3px; font-size:14px;"> ${phone}</p>` : ''}
            <p style="font-weight:600; color:#5c491f; margin-bottom:3px;">${addr.street || ''}</p>
            <p style="color:#797259; margin-bottom:3px;">${addr.city || ''}, ${addr.province || ''} ${addr.zip || ''}</p>
            <p style="color:#797259; margin-bottom:0;">${addr.country || ''}</p>
            ${timeRange ? `<p style="color:#797259; margin-top:4px; margin-bottom:0; font-size:14px;"> Available: ${timeRange}</p>` : ''}
            ${isSelected ? `<span style="
                position: absolute;
                top: 10px;
                right: 10px;
                background: #5c491f;
                color: white;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
            ">✓</span>` : ''}
        </div>
    `;
}

async function loadSavedAddresses() {
    const user = auth.currentUser;
    if (!user) return;

    const container = document.getElementById('savedAddresses');
    if (!container) return;

    try {
        const addressesRef = collection(db, "users", user.uid, "addresses");
        const snapshot = await getDocs(query(addressesRef, orderBy("createdAt", "desc")));

        if (snapshot.empty) {
            container.innerHTML = '<p style="color:#797259;">No saved addresses. Add one in your <a href="profile.html" target="_blank" style="color:#5c491f;">Profile</a>.</p>';
            return;
        }

        container.innerHTML = '';
        let defaultAddr = null;
        snapshot.forEach((docSnap) => {
            const addr = { id: docSnap.id, ...docSnap.data() };
            if (!selectedAddressId && addr.isDefault) {
                defaultAddr = addr;
            }
            const isSelected = addr.id === selectedAddressId;
            const card = document.createElement('div');
            card.innerHTML = renderAddressCard(addr, isSelected);
            const cardEl = card.firstElementChild;
            cardEl.addEventListener('click', () => selectAddress(addr));
            container.appendChild(cardEl);
        });

        if (defaultAddr && !selectedAddressId) {
            selectAddress(defaultAddr);
        }
    } catch (error) {
        console.error('Error loading saved addresses:', error);
        const container = document.getElementById('savedAddresses');
        if (container) {
            container.innerHTML = '<p style="color:#797259;">Error loading addresses.</p>';
        }
    }
}

function selectAddress(addr) {
    selectedAddressId = addr.id;
    const hasRecipient = !!formatRecipientName(addr);
    if (hasRecipient) {
        document.getElementById('firstName').value = addr.recipientFirstName || '';
        document.getElementById('middleName').value = addr.recipientMiddleName || '';
        document.getElementById('lastName').value = addr.recipientLastName || '';
    } else if (currentUserProfile) {
        document.getElementById('firstName').value = currentUserProfile.firstName || '';
        document.getElementById('middleName').value = currentUserProfile.middleName || '';
        document.getElementById('lastName').value = currentUserProfile.lastName || '';
    } else {
        document.getElementById('firstName').value = '';
        document.getElementById('middleName').value = '';
        document.getElementById('lastName').value = '';
    }
    if (hasRecipient && addr.recipientContact && iti) {
        iti.setNumber(addr.recipientContact, true);
    } else if (currentUserProfile?.contact && iti) {
        iti.setNumber(currentUserProfile.contact, true);
    } else if (iti) {
        iti.setNumber('');
    }
    document.getElementById('street').value = addr.street || '';
    document.getElementById('city').value = addr.city || '';
    document.getElementById('province').value = addr.province || '';
    document.getElementById('zip').value = addr.zip || '';
    document.getElementById('country').value = addr.country || '';
    document.getElementById('addressLabel').value = addr.label || 'home';
    document.getElementById('availableStart').value = addr.availableTimeStart || '';
    document.getElementById('availableEnd').value = addr.availableTimeEnd || '';

    loadSavedAddresses();
}

async function loadCartItems() {
    const user = auth.currentUser;
    if (!user) return;

    const container = document.getElementById('cartItems');
    if (!container) return;

    try {
        const cartRef = collection(db, "carts", user.uid, "items");
        const snapshot = await getDocs(cartRef);

        if (snapshot.empty) {
            container.innerHTML = '<p style="color:#797259;">Your cart is empty.</p>';
            updateTotals(0, 0);
            currentCartItems = [];
            return;
        }

        currentCartItems = [];
        for (const docSnap of snapshot.docs) {
            const item = { id: docSnap.id, ...docSnap.data() };
            if (item.productId) {
                const productDoc = await getDoc(doc(db, "products", item.productId));
                if (productDoc.exists()) {
                    item.stock = productDoc.data().stock || 0;
                } else {
                    item.stock = 0;
                }
            } else {
                item.stock = 0;
            }
            currentCartItems.push(item);
        }

        renderCartItems();
    } catch (error) {
        console.error('Error loading cart:', error);
        if (container) {
            container.innerHTML = '<p style="color:#797259;">Error loading cart.</p>';
        }
    }
}

function renderCartItems() {
    const container = document.getElementById('cartItems');
    if (!container) return;

    if (currentCartItems.length === 0) {
        container.innerHTML = '<p style="color:#797259;">Your cart is empty.</p>';
        updateTotals(0, 0);
        return;
    }

    container.innerHTML = currentCartItems.map((item, index) => `
        <div class="cart-item" style="
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid #dad6c2;
            gap: 15px;
        ">
            ${item.image ? `<img src="${item.image}" alt="${item.name}" style="width:60px; height:60px; object-fit:cover; border-radius:8px; border:1px solid #dad6c2; flex-shrink:0;" />` : ''}
            <div style="flex: 1; min-width: 0;">
                <p style="font-weight: 600; color: #5c491f; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.name}</p>
                <p style="color: #797259; font-size: 14px;">₱${item.price.toLocaleString()} each</p>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
                <button type="button" class="qty-btn" data-index="${index}" data-action="minus" style="
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    border: 1px solid #dad6c2;
                    background: #fffef8;
                    color: #5c491f;
                    font-size: 18px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                ">−</button>
                <span style="font-weight: 600; color: #3a382f; min-width: 24px; text-align: center;">${item.quantity}</span>
                <button type="button" class="qty-btn" data-index="${index}" data-action="plus" style="
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    border: 1px solid ${item.stock !== undefined && item.quantity >= item.stock ? '#dc3545' : '#dad6c2'};
                    background: ${item.stock !== undefined && item.quantity >= item.stock ? '#fff5f5' : '#fffef8'};
                    color: ${item.stock !== undefined && item.quantity >= item.stock ? '#dc3545' : '#5c491f'};
                    font-size: 18px;
                    cursor: ${item.stock !== undefined && item.quantity >= item.stock ? 'not-allowed' : 'pointer'};
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                    opacity: ${item.stock !== undefined && item.quantity >= item.stock ? '0.5' : '1'};
                " ${item.stock !== undefined && item.quantity >= item.stock ? 'disabled' : ''}>+</button>
            </div>
            <div style="font-weight: 600; color: #5c491f; min-width: 80px; text-align: right;">
                ₱${(item.price * item.quantity).toLocaleString()}
            </div>
            ${item.stock !== undefined && item.quantity >= item.stock ? `<span style="font-size:11px; color:#dc3545; margin-left:8px;">Max stock</span>` : ''}
        </div>
    `).join('');

    document.querySelectorAll('.qty-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const index = parseInt(btn.dataset.index);
            const action = btn.dataset.action;
            await changeQuantity(index, action);
        });
    });

    const subtotal = currentCartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    updateTotals(subtotal);
}

async function changeQuantity(index, action) {
    const user = auth.currentUser;
    if (!user) return;

    const item = currentCartItems[index];
    if (!item) return;

    let newQty = item.quantity;
    if (action === 'plus') {
        newQty += 1;
        if (item.stock !== undefined && newQty > item.stock) {
            showMessage(`Only ${item.stock} item(s) available in stock.`, 'error');
            return;
        }
    } else if (action === 'minus') {
        newQty -= 1;
    }

    if (newQty < 1) {
        if (!confirm('Remove this item from cart?')) return;
        await deleteDoc(doc(db, "carts", user.uid, "items", item.id));
        currentCartItems.splice(index, 1);
    } else {
        await updateDoc(doc(db, "carts", user.uid, "items", item.id), {
            quantity: newQty
        });
        currentCartItems[index].quantity = newQty;
    }

    renderCartItems();
}

function updateTotals(subtotal) {
    const totalEl = document.getElementById('summaryTotal');
    const subtotalEl = document.getElementById('summarySubtotal');

    if (subtotalEl) subtotalEl.textContent = `₱${subtotal.toLocaleString()}`;
    if (totalEl) totalEl.textContent = `₱${subtotal.toLocaleString()}`;
}

async function placeOrder(e) {
    e.preventDefault();
    hideMessage();

    const user = auth.currentUser;
    if (!user) {
        showMessage('Please login to place an order.', 'error');
        window.location.href = 'login.html';
        return;
    }

    const firstName = document.getElementById('firstName')?.value.trim();
    const middleName = document.getElementById('middleName')?.value.trim();
    const lastName = document.getElementById('lastName')?.value.trim();
    const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');
    const contact = document.getElementById('contact')?.value.trim();
    const fullContact = iti ? iti.getNumber() : contact;
    const street = document.getElementById('street')?.value.trim();
    const city = document.getElementById('city')?.value.trim();
    const province = document.getElementById('province')?.value.trim();
    const zip = document.getElementById('zip')?.value.trim();
    const country = document.getElementById('country')?.value.trim();
    const addressLabel = document.getElementById('addressLabel')?.value;
    const availableStart = document.getElementById('availableStart')?.value;
    const availableEnd = document.getElementById('availableEnd')?.value;
    const paymentMethod = document.querySelector('input[name="payment"]:checked')?.value;
    const proofInput = document.getElementById('proof');
    const submitBtn = document.querySelector('.place-order-btn');

    if (!fullName || !contact || !street || !city || !province || !zip || !country || !paymentMethod) {
        showMessage('Please fill in all required fields.', 'error');
        return;
    }

    if (currentCartItems.length === 0) {
        showMessage('Your cart is empty. Please add items before placing an order.', 'error');
        return;
    }

    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Placing Order...';

        // Pre-fetch and validate stock availability for all items
        const productStocks = {};
        for (const item of currentCartItems) {
            if (item.productId) {
                const productDoc = await getDoc(doc(db, "products", item.productId));
                if (!productDoc.exists()) {
                    showMessage(`Product "${item.name}" is no longer available.`, 'error');
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Place Order';
                    return;
                }
                const productData = productDoc.data();
                const currentStock = productData.stock || 0;
                if (currentStock < item.quantity) {
                    showMessage(`Only ${currentStock} item(s) available for "${item.name}". Please adjust your cart.`, 'error');
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Place Order';
                    return;
                }
                productStocks[item.productId] = currentStock;
            }
        }

        let subtotal = 0;
        const items = currentCartItems.map(item => {
            subtotal += item.price * item.quantity;
            return {
                productId: item.productId,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                image: item.image
            };
        });

        const total = subtotal;

        let proofImage = null;
        if (proofInput && proofInput.files && proofInput.files[0]) {
            proofImage = await readFileAsDataURL(proofInput.files[0]);
        }

        const addressString = [street, city, province, zip, country].filter(Boolean).join(', ');

        const orderData = {
            userId: user.uid,
            customerId: user.uid,
            customerName: fullName,
            contact: fullContact,
            address: addressString,
            items: items,
            subtotal: subtotal,
            shippingFee: 0,
            total: total,
            paymentMethod: paymentMethod,
            paymentProof: proofImage,
            status: 'pending',
            label: addressLabel,
            availableTimeStart: availableStart,
            availableTimeEnd: availableEnd,
            recipientFirstName: firstName,
            recipientMiddleName: middleName,
            recipientLastName: lastName,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        // Use batch to atomically create order, deduct stock, and clear cart
        const batch = writeBatch(db);

        // Create order
        const orderRef = doc(collection(db, "orders"));
        batch.set(orderRef, orderData);

        // Deduct stock from products
        for (const item of currentCartItems) {
            if (item.productId && productStocks[item.productId] !== undefined) {
                const currentStock = productStocks[item.productId];
                const newStock = Math.max(0, currentStock - item.quantity);
                batch.update(doc(db, "products", item.productId), {
                    stock: newStock
                });
            }
        }

        // Clear cart items
        const cartRef = collection(db, "carts", user.uid, "items");
        const cartSnapshot = await getDocs(cartRef);
        cartSnapshot.forEach(docSnap => {
            batch.delete(doc(db, "carts", user.uid, "items", docSnap.id));
        });

        await batch.commit();

        showMessage('Order placed successfully! Redirecting...', 'success');

        setTimeout(() => {
            window.location.href = 'order_tracking.html';
        }, 1500);

    } catch (error) {
        console.error('Error placing order:', error);
        showMessage('Error placing order: ' + error.message, 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Place Order';
    }
}

async function loadPaymentMethods() {
    try {
        const q = query(collection(db, "paymentMethods"), where("isActive", "==", true));
        const snapshot = await getDocs(q);
        adminPaymentMethods = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        console.log('Loaded payment methods:', adminPaymentMethods.length);
        
        renderPaymentOptions();
    } catch (error) {
        console.error('Error loading payment methods:', error);
        adminPaymentMethods = [];
        renderPaymentOptions();
    }
}

function renderPaymentOptions() {
    const container = document.getElementById('paymentOptions');
    const noMethodsMsg = document.getElementById('noPaymentMethods');
    
    if (!container) return;
    
    if (adminPaymentMethods.length === 0) {
        if (noMethodsMsg) {
            noMethodsMsg.textContent = 'No payment methods available. Contact admin.';
            noMethodsMsg.style.display = 'block';
        }
        return;
    }
    
    let html = '';
    
    adminPaymentMethods.forEach((method, index) => {
        const checked = index === 0 ? 'checked' : '';
        html += `<label>
            <input type="radio" name="payment" value="${method.methodType}" data-method-id="${method.id}" ${checked}>
            ${method.methodName}
        </label>`;
    });
    
    container.innerHTML = html;
    if (noMethodsMsg) noMethodsMsg.style.display = 'none';
    
    const firstRadio = container.querySelector('input[name="payment"]');
    if (firstRadio) {
        showPaymentCredentials(firstRadio.value);
    }
    setupPaymentListeners();
}

function showPaymentCredentials(methodType) {
    const container = document.getElementById('paymentCredentials');
    if (!container) return;
    
    const titleEl = document.getElementById('paymentCredentialsTitle');
    const contentEl = document.getElementById('paymentCredentialsContent');

    if (!adminPaymentMethods.length) {
        container.style.display = 'none';
        return;
    }

    const selectedMethod = adminPaymentMethods.find(m => m.methodType === methodType);

    if (!selectedMethod) {
        container.style.display = 'none';
        return;
    }

    titleEl.textContent = `${selectedMethod.methodName} Payment Details`;
    
    let content = `<p style="margin:6px 0; font-size:15px;"><strong>Account Name:</strong> ${selectedMethod.accountName}</p>`;
    
    const lowerName = selectedMethod.methodType.toLowerCase();
    if (lowerName.includes('gcash')) {
        content += `<p style="margin:6px 0; font-size:15px;"><strong>GCash Number:</strong> ${selectedMethod.accountNumber}</p>`;
    } else if (lowerName.includes('maya') || lowerName.includes('paymaya')) {
        content += `<p style="margin:6px 0; font-size:15px;"><strong>Maya Number:</strong> ${selectedMethod.accountNumber}</p>`;
    } else if (lowerName.includes('coins')) {
        content += `<p style="margin:6px 0; font-size:15px;"><strong>Coins.ph Number:</strong> ${selectedMethod.accountNumber}</p>`;
    } else if (lowerName.includes('bank')) {
        content += `<p style="margin:6px 0; font-size:15px;"><strong>Account Number:</strong> ${selectedMethod.accountNumber}</p>`;
        if (selectedMethod.bankName) {
            content += `<p style="margin:6px 0; font-size:15px;"><strong>Bank:</strong> ${selectedMethod.bankName}</p>`;
        }
    } else {
        content += `<p style="margin:6px 0; font-size:15px;"><strong>Account Number:</strong> ${selectedMethod.accountNumber}</p>`;
        if (selectedMethod.bankName) {
            content += `<p style="margin:6px 0; font-size:15px;"><strong>Bank:</strong> ${selectedMethod.bankName}</p>`;
        }
    }

    contentEl.innerHTML = content;
    container.style.display = 'block';
}

function setupPaymentListeners() {
    const paymentRadios = document.querySelectorAll('input[name="payment"]');
    paymentRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            showPaymentCredentials(e.target.value);
        });
    });
}

let loadCheckoutInitialized = false;

function initIntlTelInput(userContact) {
    if (typeof window.intlTelInput === 'undefined') {
        console.log('intlTelInput not loaded yet, will retry');
        setTimeout(() => initIntlTelInput(userContact), 100);
        return;
    }
    
    const contactInput = document.getElementById('contact');
    if (contactInput && !iti) {
        try {
            iti = window.intlTelInput(contactInput, {
                initialCountry: 'ph',
                preferredCountries: ['ph', 'us', 'gb', 'sg', 'au', 'il', 'id', 'my', 'th', 'jp', 'kr', 'cn', 'in', 'de', 'fr', 'it', 'es', 'ae', 'sa', 'ca', 'nz'],
                separateDialCode: true,
                utilsScript: 'https://cdn.jsdelivr.net/npm/intl-tel-input@19.5.0/build/js/utils.js'
            });
            if (userContact) {
                iti.setNumber(userContact, true);
            }
        } catch (e) {
            console.error('Failed to init intlTelInput:', e);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded');
});

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace('login.html');
        return;
    }

    if (!loadCheckoutInitialized) {
        loadCheckoutInitialized = true;
        const placeOrderForm = document.querySelector('.checkout-form form');
        if (placeOrderForm) {
            placeOrderForm.addEventListener('submit', placeOrder);
        }
    }
    
    const userDocRef = doc(db, "users", user.uid);
    const userDocSnap = await getDoc(userDocRef);
    currentUserProfile = userDocSnap.exists() ? userDocSnap.data() : null;

    if (currentUserProfile?.firstName || currentUserProfile?.lastName) {
        document.getElementById('firstName').value = currentUserProfile.firstName || '';
        document.getElementById('middleName').value = currentUserProfile.middleName || '';
        document.getElementById('lastName').value = currentUserProfile.lastName || '';
    }
    if (currentUserProfile?.contact) {
        initIntlTelInput(currentUserProfile.contact);
    }

    loadPaymentMethods();
    loadSavedAddresses();
    loadCartItems();
});
