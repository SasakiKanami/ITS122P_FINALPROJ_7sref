import { db } from "./firebase-config.js";
import {
    collection, addDoc, doc, deleteDoc, updateDoc, onSnapshot, query, orderBy, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAdminStateChanged } from "./admin_security.js";

const CLOUDINARY_CLOUD = 'dupigtgx6';
const CLOUDINARY_PRESET = 'WanderLustBagsPH';
const PRODUCT_COLLECTION = 'products';

let editingProductId = null;
let currentProductData = null;
let allProducts = [];

// ==================== CLOUDINARY UPLOAD ====================
async function uploadToCloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_PRESET);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
        method: 'POST',
        body: formData
    });

    const data = await response.json();
    if (!data.secure_url) {
        throw new Error(data.error?.message || 'Image upload failed.');
    }

    return {
        url: data.secure_url,
        public_id: data.public_id
    };
}

async function deleteFromCloudinary(public_id) {
    if (!public_id) return null;

    const endpoints = ['/api/delete-cloudinary'];
    let lastError = null;

    for (const url of endpoints) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ public_id })
            });

            if (res.ok) {
                return await res.json();
            }

            lastError = new Error(`Delete request to ${url} failed with status ${res.status}`);
        } catch (error) {
            lastError = error;
        }
    }

    console.error('Error deleting from Cloudinary: all endpoints failed', lastError);
    return null;
}

function extractPublicIdFromUrl(url) {
    if (!url) return null;

    try {
        const parsed = new URL(url);
        const parts = parsed.pathname.split('/');
        const uploadIndex = parts.indexOf('upload');
        if (uploadIndex === -1) return null;
        const publicPath = parts.slice(uploadIndex + 2).join('/');
        return publicPath ? publicPath.replace(/\.[^/.]+$/, '') : null;
    } catch {
        return null;
    }
}

// ==================== AUTH CHECK ====================
onAdminStateChanged((user, userData) => {
    document.getElementById('adminName').textContent = userData?.username || 'Admin';
    setupForm();
    setupTableActions();
    loadProducts();
});

// ==================== IMAGE PREVIEW ====================
function setupImagePreview() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('productImage');
    const imagePreview = document.getElementById('imagePreview');
    const previewImg = document.getElementById('previewImg');
    const removeImage = document.getElementById('removeImage');

    dropZone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) showPreview(file);
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.background = '#f0ebe0';
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.style.background = '#fffef8';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.background = '#fffef8';
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            fileInput.files = dataTransfer.files;
            showPreview(file);
        } else {
            alert('Please drop an image file.');
        }
    });

    function showPreview(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImg.src = e.target.result;
            imagePreview.style.display = 'block';
            dropZone.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }

    removeImage.addEventListener('click', () => {
        fileInput.value = '';
        previewImg.src = '';
        imagePreview.style.display = 'none';
        dropZone.style.display = 'block';
    });
}

// ==================== FORM STATE ====================
function resetForm() {
    const addProductForm = document.getElementById('addProductForm');
    const submitBtn = document.getElementById('submitBtn');
    const cancelBtn = document.getElementById('cancelBtn');

    editingProductId = null;
    currentProductData = null;
    addProductForm.reset();
    submitBtn.textContent = 'Add Product';
    submitBtn.disabled = false;
    cancelBtn.style.display = 'none';
    document.getElementById('formTitle').textContent = 'Add New Product';
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('dropZone').style.display = 'block';
    document.getElementById('previewImg').src = '';
}

function setFormMode(isEditing) {
    const submitBtn = document.getElementById('submitBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const formTitle = document.getElementById('formTitle');

    if (isEditing) {
        submitBtn.textContent = 'Update Product';
        cancelBtn.style.display = 'block';
        formTitle.textContent = 'Editing Product';
    } else {
        submitBtn.textContent = 'Add Product';
        cancelBtn.style.display = 'none';
        formTitle.textContent = 'Add New Product';
    }
}

function showProductForm() {
    const addProductForm = document.getElementById('addProductForm');
    addProductForm.style.display = 'block';
}

function hideProductForm() {
    resetForm();
    document.getElementById('addProductForm').style.display = 'none';
}

function setSubmitState(isBusy, busyText = 'Saving...') {
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = isBusy;
    submitBtn.textContent = isBusy ? busyText : (editingProductId ? 'Update Product' : 'Add Product');
}

function getFormValues() {
    return {
        name: document.getElementById('productName').value.trim(),
        price: parseFloat(document.getElementById('productPrice').value),
        category: document.getElementById('productCategory').value,
        stock: parseInt(document.getElementById('productStock').value),
        description: document.getElementById('productDescription').value.trim(),
        imageFile: document.getElementById('productImage').files[0]
    };
}

async function createProduct(productData) {
    let imageUrl = '';
    let imagePublicId = '';

    if (productData.imageFile) {
        const uploaded = await uploadToCloudinary(productData.imageFile);
        imageUrl = uploaded.url;
        imagePublicId = uploaded.public_id;
    }

    await addDoc(collection(db, PRODUCT_COLLECTION), {
        name: productData.name,
        price: productData.price,
        category: productData.category,
        stock: productData.stock,
        description: productData.description,
        image: imageUrl,
        publicId: imagePublicId,
        createdAt: new Date()
    });
}

async function updateProduct(productId, productData) {
    const productRef = doc(db, PRODUCT_COLLECTION, productId);
    let imageUrl = currentProductData?.image || '';
    let imagePublicId = currentProductData?.publicId || extractPublicIdFromUrl(currentProductData?.image);

    if (productData.imageFile) {
        if (imagePublicId) {
            await deleteFromCloudinary(imagePublicId);
        }
        const uploaded = await uploadToCloudinary(productData.imageFile);
        imageUrl = uploaded.url;
        imagePublicId = uploaded.public_id;
    }

    await updateDoc(productRef, {
        name: productData.name,
        price: productData.price,
        category: productData.category,
        stock: productData.stock,
        description: productData.description,
        image: imageUrl,
        publicId: imagePublicId,
        updatedAt: new Date()
    });
}

// ==================== ADD/EDIT PRODUCT ====================
function setupForm() {
    const addProductForm = document.getElementById('addProductForm');
    const toggleFormBtn = document.getElementById('toggleFormBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const productSearch = document.getElementById('productSearch');
    const productFilterCategory = document.getElementById('productFilterCategory');

    setupImagePreview();

    toggleFormBtn.addEventListener('click', () => {
        const form = document.getElementById('addProductForm');
        if (form.style.display === 'block') {
            hideProductForm();
            return;
        }

        resetForm();
        setFormMode(false);
        showProductForm();
        form.scrollIntoView({ behavior: 'smooth' });
    });

    cancelBtn.addEventListener('click', hideProductForm);
    productSearch.addEventListener('input', renderProducts);
    productFilterCategory.addEventListener('change', renderProducts);

    addProductForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const productData = getFormValues();
        if (!productData.name || !productData.price) {
            alert('Product name and price are required.');
            return;
        }

        setSubmitState(true, editingProductId ? 'Updating...' : 'Adding...');

        try {
            if (editingProductId) {
                await updateProduct(editingProductId, productData);
                alert('Product updated successfully!');
            } else {
                await createProduct(productData);
                alert('Product added successfully!');
            }

            hideProductForm();
        } catch (error) {
            alert('Error saving product: ' + error.message);
        } finally {
            setSubmitState(false);
        }
    });
}

// ==================== LOAD PRODUCTS ====================
function loadProducts() {
    const q = query(collection(db, PRODUCT_COLLECTION), orderBy('createdAt', 'desc'));

    onSnapshot(q, (snapshot) => {
        allProducts = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        renderProducts();
    });
}

function renderProducts() {
    const tbody = document.getElementById('productsTableBody');
    const search = document.getElementById('productSearch').value.trim().toLowerCase();
    const category = document.getElementById('productFilterCategory').value;

    const filteredProducts = allProducts.filter((product) => {
        const matchesSearch = !search || `${product.name || ''} ${product.description || ''}`.toLowerCase().includes(search);
        const matchesCategory = category === 'All' || product.category === category;
        return matchesSearch && matchesCategory;
    });

    updateProductCount(filteredProducts.length);

    if (!filteredProducts.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#888;">No products found</td></tr>';
        return;
    }

    tbody.innerHTML = filteredProducts.map((product) => {
        return `
            <tr>
                <td>
                    ${product.image
                        ? `<img src="${product.image}" class="product-img" alt="${product.name}" onerror="this.style.display='none'">`
                        : `<div class="product-img" style="background:#f0ebe0; display:flex; align-items:center; justify-content:center; font-size:11px; color:#aaa;">No Image</div>`}
                </td>
                <td><strong>${product.name}</strong><br><small style="color:#888;">${product.description || ''}</small></td>
                <td>${product.category || 'N/A'}</td>
                <td>₱${(product.price || 0).toLocaleString()}</td>
                <td>${product.stock || 0}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-primary btn-sm edit-btn" data-id="${product.id}">Edit</button>
                        <button class="btn btn-danger btn-sm delete-btn" data-id="${product.id}">Delete</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function updateProductCount(count) {
    const productCount = document.getElementById('productCount');
    productCount.textContent = `${count} product${count === 1 ? '' : 's'}`;
}

// ==================== TABLE ACTIONS ====================
function setupTableActions() {
    const tbody = document.getElementById('productsTableBody');

    tbody.addEventListener('click', async (event) => {
        const target = event.target.closest('button');
        if (!target) return;

        const productId = target.dataset.id;
        if (target.classList.contains('delete-btn')) {
            await handleDeleteProduct(productId);
        }

        if (target.classList.contains('edit-btn')) {
            await handleEditProduct(productId);
        }
    });
}

async function handleDeleteProduct(productId) {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
        const product = allProducts.find((item) => item.id === productId);
        const publicId = product?.publicId || extractPublicIdFromUrl(product?.image);

        if (publicId) {
            await deleteFromCloudinary(publicId);
        }

        await deleteDoc(doc(db, PRODUCT_COLLECTION, productId));
        alert('Product deleted successfully!');
    } catch (error) {
        alert('Error deleting product: ' + error.message);
    }
}

async function handleEditProduct(productId) {
    const product = allProducts.find((item) => item.id === productId);
    if (!product) return;

    currentProductData = product;
    editingProductId = productId;

    document.getElementById('productName').value = product.name || '';
    document.getElementById('productPrice').value = product.price || '';
    document.getElementById('productCategory').value = product.category || 'Bags';
    document.getElementById('productStock').value = product.stock || 0;
    document.getElementById('productDescription').value = product.description || '';
    document.getElementById('productImage').value = '';

    if (product.image) {
        document.getElementById('previewImg').src = product.image;
        document.getElementById('imagePreview').style.display = 'block';
        document.getElementById('dropZone').style.display = 'none';
    } else {
        document.getElementById('previewImg').src = '';
        document.getElementById('imagePreview').style.display = 'none';
        document.getElementById('dropZone').style.display = 'block';
    }

    setFormMode(true);
    showProductForm();
    document.getElementById('addProductForm').scrollIntoView({ behavior: 'smooth' });
}
