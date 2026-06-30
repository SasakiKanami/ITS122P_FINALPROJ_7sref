// user_products.js
import { auth, db } from "./firebase-config.js";
import {
    collection,
    onSnapshot,
    query,
    orderBy,
    where,
    getDoc,
    doc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ==================== LOAD PRODUCTS FOR USER ====================
function loadUserProducts() {
    const productGrid = document.getElementById('productGrid');
    const productCount = document.getElementById('userProductCount');
    
    if (!productGrid) {
        console.error('Product grid element not found');
        return;
    }

    // Show loading state
    productGrid.innerHTML = '<div class="loading-products">Loading products...</div>';

    // Query products from the SAME Firestore collection as admin
    // Only show products with stock > 0 (available for purchase)
    const q = query(
        collection(db, "products"),
        where("stock", ">", 0),
        orderBy("createdAt", "desc")
    );

    // Real-time listener - updates automatically when admin adds/edits/deletes
    onSnapshot(q, (snapshot) => {
        // Update product count
        if (productCount) {
            productCount.textContent = snapshot.size + ' products';
        }

        if (snapshot.empty) {
            productGrid.innerHTML = `
                <div class="no-products">
                    <p>No products available at the moment.</p>
                    <p>Check back soon for new arrivals!</p>
                </div>
            `;
            return;
        }

        // Clear grid
        productGrid.innerHTML = '';

        // Render each product
        snapshot.forEach((docSnap) => {
            const product = docSnap.data();
            const productId = docSnap.id;

            const productCard = document.createElement('div');
            productCard.className = 'product-card';
            productCard.innerHTML = `
                ${product.image ? 
                    `<img src="${product.image}" alt="${product.name}" class="product-image" />` :
                    `<div class="product-image-placeholder">No Image</div>`
                }
                <div class="product-info">
                    <h3 class="product-name">${product.name}</h3>
                    <p class="product-category">${product.category || 'Uncategorized'}</p>
                    <p class="product-price">₱${(product.price || 0).toLocaleString()}</p>
                    <p class="product-stock in-stock">✓ In Stock (${product.stock} available)</p>
                    <button class="add-to-cart-btn" data-id="${productId}">
                        Add to Cart
                    </button>
                    <button class="view-details-btn" data-id="${productId}">
                        View Details
                    </button>
                </div>
            `;
            productGrid.appendChild(productCard);
        });

        // Attach event listeners to buttons
        document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const productId = e.target.dataset.id;
                addToCart(productId);
            });
        });

        document.querySelectorAll('.view-details-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const productId = e.target.dataset.id;
                viewProductDetails(productId);
            });
        });

    }, (error) => {
        console.error('Error loading products:', error);
        productGrid.innerHTML = `
            <div class="error-message">
                <p>Error loading products. Please try again later.</p>
                <p style="font-size:14px; color:#888;">${error.message}</p>
            </div>
        `;
    });
}

// ==================== SEARCH FUNCTIONALITY ====================
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;

    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const searchTerm = e.target.value.trim().toLowerCase();
            filterProducts(searchTerm);
        }, 300);
    });
}

function filterProducts(searchTerm) {
    const productCards = document.querySelectorAll('.product-card');
    const productCount = document.getElementById('userProductCount');
    let visibleCount = 0;

    productCards.forEach(card => {
        const name = card.querySelector('.product-name')?.textContent?.toLowerCase() || '';
        const category = card.querySelector('.product-category')?.textContent?.toLowerCase() || '';
        
        if (name.includes(searchTerm) || category.includes(searchTerm)) {
            card.style.display = 'block';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });

    if (productCount) {
        productCount.textContent = visibleCount + ' products';
    }

    // Show "no results" message if needed
    const noResults = document.getElementById('noSearchResults');
    if (visibleCount === 0 && searchTerm !== '') {
        if (!noResults) {
            const grid = document.getElementById('productGrid');
            const msg = document.createElement('div');
            msg.id = 'noSearchResults';
            msg.className = 'no-products';
            msg.innerHTML = `<p>No products found matching "${searchTerm}"</p>`;
            grid.appendChild(msg);
        }
    } else if (noResults) {
        noResults.remove();
    }
}

// ==================== CATEGORY FILTERS ====================
function setupCategoryFilters() {
    document.querySelectorAll('.category-filter').forEach(filterBtn => {
        filterBtn.addEventListener('click', (e) => {
            const category = e.target.dataset.category;
            
            // Update active state
            document.querySelectorAll('.category-filter').forEach(btn => {
                btn.classList.remove('active');
            });
            e.target.classList.add('active');

            // Filter products
            const productCards = document.querySelectorAll('.product-card');
            const productCount = document.getElementById('userProductCount');
            let visibleCount = 0;

            productCards.forEach(card => {
                const productCategory = card.querySelector('.product-category')?.textContent || '';
                
                if (category === 'All' || productCategory === category) {
                    card.style.display = 'block';
                    visibleCount++;
                } else {
                    card.style.display = 'none';
                }
            });

            if (productCount) {
                productCount.textContent = visibleCount + ' products';
            }

            // Clear search input when filtering by category
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.value = '';
            }
        });
    });
}

// ==================== ADD TO CART ====================
async function addToCart(productId) {
    // Check if user is logged in
    const user = auth.currentUser;
    if (!user) {
        alert('Please login to add items to cart.');
        window.location.href = 'login.html';
        return;
    }

    try {
        // Get product details
        const productDoc = await getDoc(doc(db, "products", productId));
        if (!productDoc.exists()) {
            alert('Product not found.');
            return;
        }

        const product = productDoc.data();
        
        // Here you can implement your cart logic
        // For now, we'll show a confirmation
        alert(`Added "${product.name}" to cart! (Implement your cart logic here)`);
        
        // Example: Add to cart collection in Firestore
        // await addDoc(collection(db, "carts", user.uid, "items"), {
        //     productId: productId,
        //     name: product.name,
        //     price: product.price,
        //     quantity: 1,
        //     image: product.image,
        //     addedAt: new Date()
        // });

    } catch (error) {
        console.error('Error adding to cart:', error);
        alert('Error adding to cart: ' + error.message);
    }
}

// ==================== VIEW PRODUCT DETAILS ====================
function viewProductDetails(productId) {
    // Navigate to product details page
    // window.location.href = `product_details.html?id=${productId}`;
    alert(`Viewing product ${productId} (Implement product details page)`);
}

// ==================== AUTH CHECK ====================
onAuthStateChanged(auth, (user) => {
    // Load products regardless of auth status
    // (users can browse without logging in)
    loadUserProducts();
    setupSearch();
    setupCategoryFilters();
    
    // Update UI based on auth status
    const authButtons = document.getElementById('authButtons');
    if (authButtons) {
        if (user) {
            authButtons.innerHTML = `
                <span>Welcome, ${user.displayName || 'User'}</span>
                <button onclick="logout()">Logout</button>
            `;
        } else {
            authButtons.innerHTML = `
                <a href="login.html">Login</a>
                <a href="register.html">Register</a>
            `;
        }
    }
});

// ==================== LOGOUT ====================
window.logout = async function() {
    try {
        await auth.signOut();
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Error logging out:', error);
    }
};