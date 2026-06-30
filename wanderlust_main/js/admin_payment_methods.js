import { db } from "./firebase-config.js";
import {
    collection, addDoc, doc, deleteDoc, updateDoc, onSnapshot, query, orderBy, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAdminStateChanged } from "./admin_security.js";

const PAYMENT_METHODS_COLLECTION = 'paymentMethods';

let editingMethodId = null;
let allPaymentMethods = [];
let currentIsActive = true;

onAdminStateChanged((user, userData) => {
    document.getElementById('adminName').textContent = userData?.username || userData?.firstName || 'Admin';
    setupForm();
    setupTableActions();
    loadPaymentMethods();
});

function resetForm() {
    const form = document.getElementById('addPaymentMethodForm');
    const submitBtn = document.getElementById('submitBtn');
    const cancelBtn = document.getElementById('cancelBtn');

    editingMethodId = null;
    form.reset();
    submitBtn.textContent = 'Add Method';
    submitBtn.disabled = false;
    cancelBtn.style.display = 'none';
    document.getElementById('formTitle').textContent = 'Add Payment Method';
    document.getElementById('bankNameGroup').style.display = 'none';
    currentIsActive = true;
    const btnActive = document.getElementById('btnActive');
    const btnInactive = document.getElementById('btnInactive');
    if (btnActive && btnInactive) {
        btnActive.style.opacity = '1';
        btnInactive.style.opacity = '0.5';
    }
}

function setFormMode(isEditing) {
    const submitBtn = document.getElementById('submitBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const formTitle = document.getElementById('formTitle');

    if (isEditing) {
        submitBtn.textContent = 'Update Method';
        cancelBtn.style.display = 'block';
        formTitle.textContent = 'Editing Payment Method';
    } else {
        submitBtn.textContent = 'Add Method';
        cancelBtn.style.display = 'none';
        formTitle.textContent = 'Add Payment Method';
    }
}

function setupMethodTypeToggle() {
    const methodName = document.getElementById('methodName');
    const bankNameGroup = document.getElementById('bankNameGroup');

    methodName.addEventListener('input', () => {
        const val = methodName.value.toLowerCase();
        if (val.includes('bank')) {
            bankNameGroup.style.display = 'block';
        } else {
            bankNameGroup.style.display = 'none';
        }
    });
}

function setupForm() {
    const form = document.getElementById('addPaymentMethodForm');
    const toggleFormBtn = document.getElementById('toggleFormBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    
    const btnActive = document.getElementById('btnActive');
    const btnInactive = document.getElementById('btnInactive');

    setupMethodTypeToggle();

    btnActive?.addEventListener('click', () => {
        currentIsActive = true;
        btnActive.style.opacity = '1';
        btnInactive.style.opacity = '0.5';
    });

    btnInactive?.addEventListener('click', () => {
        currentIsActive = false;
        btnActive.style.opacity = '0.5';
        btnInactive.style.opacity = '1';
    });

    toggleFormBtn.addEventListener('click', () => {
        if (form.style.display === 'block' || form.style.display === '') {
            resetForm();
            form.style.display = 'none';
        } else {
            resetForm();
            form.style.display = 'block';
            form.scrollIntoView({ behavior: 'smooth' });
        }
    });

    cancelBtn.addEventListener('click', () => {
        resetForm();
        form.style.display = 'none';
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const methodName = document.getElementById('methodName').value.trim();
        const accountName = document.getElementById('accountName').value.trim();
        const accountNumber = document.getElementById('accountNumber').value.trim();
        const bankName = document.getElementById('bankName').value.trim();

        if (!methodName || !accountName || !accountNumber) {
            alert('Method name, account name, and account number are required.');
            return;
        }

        const submitBtn = document.getElementById('submitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = editingMethodId ? 'Updating...' : 'Adding...';

        try {
            if (editingMethodId) {
                await updatePaymentMethod(editingMethodId, {
                    methodName, accountName, accountNumber, bankName, isActive: currentIsActive
                });
                alert('Payment method updated successfully!');
            } else {
                await createPaymentMethod({
                    methodName, accountName, accountNumber, bankName, isActive: currentIsActive
                });
                alert('Payment method added successfully!');
            }
            resetForm();
            form.style.display = 'none';
        } catch (error) {
            alert('Error saving payment method: ' + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = editingMethodId ? 'Update Method' : 'Add Method';
        }
    });
}

async function createPaymentMethod(methodData) {
    const methodType = methodData.methodName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    await addDoc(collection(db, PAYMENT_METHODS_COLLECTION), {
        methodName: methodData.methodName,
        methodType: methodType,
        accountName: methodData.accountName,
        accountNumber: methodData.accountNumber,
        bankName: methodData.bankName || '',
        isActive: methodData.isActive,
        createdAt: new Date()
    });
}

async function updatePaymentMethod(methodId, methodData) {
    const methodRef = doc(db, PAYMENT_METHODS_COLLECTION, methodId);
    const methodType = methodData.methodName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    await updateDoc(methodRef, {
        methodName: methodData.methodName,
        methodType: methodType,
        accountName: methodData.accountName,
        accountNumber: methodData.accountNumber,
        bankName: methodData.bankName || '',
        isActive: methodData.isActive,
        updatedAt: new Date()
    });
}

function loadPaymentMethods() {
    const q = query(collection(db, PAYMENT_METHODS_COLLECTION), orderBy('createdAt', 'desc'));

    onSnapshot(q, (snapshot) => {
        allPaymentMethods = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        renderPaymentMethods();
    });
}

function renderPaymentMethods() {
    const tbody = document.getElementById('paymentMethodsTableBody');
    const countEl = document.getElementById('methodCount');

    countEl.textContent = `${allPaymentMethods.length} method${allPaymentMethods.length === 1 ? '' : 's'}`;

    if (!allPaymentMethods.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#888;">No payment methods configured</td></tr>';
        return;
    }

    tbody.innerHTML = allPaymentMethods.map((method) => {
        const statusBadge = method.isActive
            ? '<span class="badge-status active">Active</span>'
            : '<span class="badge-status inactive">Inactive</span>';

        return `
            <tr>
                <td><strong>${method.methodName || ''}</strong></td>
                <td>${method.accountName || ''}</td>
                <td>${method.accountNumber || ''}</td>
                <td>${method.bankName || '-'}</td>
                <td>${statusBadge}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-primary btn-sm edit-btn" data-id="${method.id}">Edit</button>
                        <button class="btn btn-danger btn-sm delete-btn" data-id="${method.id}">Delete</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function setupTableActions() {
    const tbody = document.getElementById('paymentMethodsTableBody');

    tbody.addEventListener('click', async (event) => {
        const target = event.target.closest('button');
        if (!target) return;

        const methodId = target.dataset.id;
        if (target.classList.contains('delete-btn')) {
            await handleDeleteMethod(methodId);
        }
        if (target.classList.contains('edit-btn')) {
            await handleEditMethod(methodId);
        }
    });
}

async function handleDeleteMethod(methodId) {
    if (!confirm('Are you sure you want to delete this payment method?')) return;

    try {
        await deleteDoc(doc(db, PAYMENT_METHODS_COLLECTION, methodId));
        alert('Payment method deleted successfully!');
    } catch (error) {
        alert('Error deleting payment method: ' + error.message);
    }
}

async function handleEditMethod(methodId) {
    const method = allPaymentMethods.find((item) => item.id === methodId);
    if (!method) return;

    editingMethodId = methodId;

    document.getElementById('methodName').value = method.methodName || '';
    document.getElementById('accountName').value = method.accountName || '';
    document.getElementById('accountNumber').value = method.accountNumber || '';
    document.getElementById('bankName').value = method.bankName || '';
    currentIsActive = method.isActive !== false;
    
    const btnActive = document.getElementById('btnActive');
    const btnInactive = document.getElementById('btnInactive');
    if (btnActive && btnInactive) {
        if (currentIsActive) {
            btnActive.style.opacity = '1';
            btnInactive.style.opacity = '0.5';
        } else {
            btnActive.style.opacity = '0.5';
            btnInactive.style.opacity = '1';
        }
    }

    if (method.bankName) {
        document.getElementById('bankNameGroup').style.display = 'block';
    } else {
        document.getElementById('bankNameGroup').style.display = 'none';
    }

    setFormMode(true);
    const form = document.getElementById('addPaymentMethodForm');
    form.style.display = 'block';
    form.scrollIntoView({ behavior: 'smooth' });
}