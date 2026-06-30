import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { isAdminUser } from "./admin_security.js";

// ==================== CAROUSEL ====================
let carouselProducts = [];
let carouselCurrentIndex = 0;
let carouselTimer = null;

// Get random index for initial image
function getRandomStartIndex() {
    return Math.floor(Math.random() * carouselProducts.length);
}

async function initCarousel() {
    const carouselCurrent = document.getElementById('carouselCurrent');
    const carouselDots = document.getElementById('carouselDots');
    
    if (!carouselCurrent) return;
    
    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        carouselProducts = [];
        querySnapshot.forEach(docSnap => {
            const product = docSnap.data();
            if (product.image && product.image.trim() !== '') {
                carouselProducts.push(product);
            }
        });
        
        if (carouselProducts.length === 0) {
            carouselCurrent.src = 'https://placehold.co/400x500/e2d7c3/5c491f?text=Products';
            carouselCurrent.alt = 'No products available';
            return;
        }
        
        // Start with random image
        carouselCurrentIndex = getRandomStartIndex();
        carouselCurrent.src = carouselProducts[carouselCurrentIndex].image;
        carouselCurrent.alt = carouselProducts[carouselCurrentIndex].name || 'Featured Product';
        
        carouselDots.innerHTML = carouselProducts.map((_, i) => 
            `<span class="carousel-dot ${i === carouselCurrentIndex ? 'active' : ''}"></span>`
        ).join('');
        
        startCarouselAutoSlide();
    } catch (error) {
        console.error('Error loading carousel products:', error);
        carouselCurrent.src = 'https://placehold.co/400x500/e2d7c3/5c491f?text=Products';
    }
}

function startCarouselAutoSlide() {
    carouselTimer = setInterval(() => {
        showNextCarouselSlide();
    }, 5000);
}

function showNextCarouselSlide() {
    if (carouselProducts.length <= 1) return;
    
    const carouselCurrent = document.getElementById('carouselCurrent');
    const carouselDots = document.getElementById('carouselDots');
    
    if (!carouselCurrent || !carouselDots) return;
    
    carouselCurrentIndex = (carouselCurrentIndex + 1) % carouselProducts.length;
    
    carouselCurrent.classList.add('next');
    
    setTimeout(() => {
        carouselCurrent.src = carouselProducts[carouselCurrentIndex].image;
        carouselCurrent.alt = carouselProducts[carouselCurrentIndex].name || 'Featured Product';
        carouselCurrent.classList.remove('next');
        
        carouselDots.querySelectorAll('.carousel-dot').forEach((dot, i) => {
            dot.classList.toggle('active', i === carouselCurrentIndex);
        });
    }, 250);
}

// ==================== ADMIN LOGIN ====================
const adminForm = document.getElementById('admin-login-form');

adminForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value;
    const errorDiv = document.getElementById('admin-login-error');

    errorDiv.textContent = '';

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        const isAdmin = await isAdminUser(user);
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const userData = userDoc.data();

        if (!isAdmin) {
            errorDiv.textContent = 'Access denied. You are not authorized as admin.';
            return;
        }

        // Save admin session
        sessionStorage.setItem('adminLoggedIn', 'true');
        sessionStorage.setItem('adminEmail', email);
        sessionStorage.setItem('adminName', userData?.username || 'Admin');

        window.location.href = 'admin_dashboard.html';

    } catch (error) {
        switch (error.code) {
            case 'auth/invalid-credential':
                errorDiv.textContent = 'Invalid email or password. Please try again.';
                break;
            case 'auth/invalid-email':
                errorDiv.textContent = 'Please enter a valid email address.';
                break;
            default:
                errorDiv.textContent = 'Error: ' + error.message;
        }
    }
});

// ==================== INIT CAROUSEL ====================
document.addEventListener('DOMContentLoaded', () => {
    initCarousel();
});