import { auth, db } from "./firebase-config.js";
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
    doc,
    setDoc,
    getDoc,
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ==================== CAROUSEL FUNCTIONALITY ====================
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
            carouselCurrent.src = 'https://placehold.co/400x500/e2d7c3/5c491f?text=Explore+Products';
            carouselCurrent.alt = 'No products available';
            return;
        }
        
        // Start with random image
        carouselCurrentIndex = getRandomStartIndex();
        carouselCurrent.src = carouselProducts[carouselCurrentIndex].image;
        carouselCurrent.alt = carouselProducts[carouselCurrentIndex].name || 'Featured Product';
        
        // Create dots
        carouselDots.innerHTML = carouselProducts.map((_, i) => 
            `<span class="carousel-dot ${i === carouselCurrentIndex ? 'active' : ''}"></span>`
        ).join('');
        
        // Start auto-slide
        startCarouselAutoSlide();
    } catch (error) {
        console.error('Error loading carousel products:', error);
        carouselCurrent.src = 'https://placehold.co/400x500/e2d7c3/5c491f?text=Explore+Products';
        carouselCurrent.alt = 'Products unavailable';
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
    
    // Fade effect
    carouselCurrent.classList.add('next');
    
    setTimeout(() => {
        carouselCurrent.src = carouselProducts[carouselCurrentIndex].image;
        carouselCurrent.alt = carouselProducts[carouselCurrentIndex].name || 'Featured Product';
        carouselCurrent.classList.remove('next');
    }, 250);
    
    // Update dots
    carouselDots.querySelectorAll('.carousel-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === carouselCurrentIndex);
    });
}

// ==================== REGISTER ====================
const registerForm = document.querySelector(".form-box.register form");

if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const username = registerForm.querySelector("input[placeholder='Username']").value.trim();
        const firstName = registerForm.querySelector("#reg-fname").value.trim();
        const middleName = registerForm.querySelector("#reg-mname").value.trim();
        const lastName = registerForm.querySelector("#reg-lname").value.trim();
        const fullname = [firstName, middleName, lastName].filter(Boolean).join(' ');
        const contact = registerForm.querySelector("#reg-contact").value.trim();
        const email = registerForm.querySelector("input[placeholder='Email']").value.trim();
        const password = registerForm.querySelector("input[placeholder='Password']").value;

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            await setDoc(doc(db, "users", user.uid), {
                username: username,
                firstName: firstName,
                middleName: middleName,
                lastName: lastName,
                contact: contact,
                email: email,
                createdAt: new Date(),
            });

            // Firebase signs the user in automatically after registration,
            // so we sign them back out to force a manual login.
            await signOut(auth);

            alert("Registration successful! Please login.");
            window.location.href = "login.html";

        } catch (error) {
            switch (error.code) {
                case 'auth/email-already-in-use':
                    alert("This email is already registered! Please login instead.");
                    break;
                case 'auth/invalid-email':
                    alert("Please enter a valid email address.");
                    break;
                case 'auth/weak-password':
                    alert("Password must be at least 6 characters.");
                    break;
                default:
                    alert("Error: " + error.message);
            }
        }
    });
}

// ==================== LOGIN ====================
const loginForm = document.querySelector(".form-box.login form");

if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = loginForm.querySelector("input[placeholder='Email']").value.trim();
        const password = loginForm.querySelector("input[placeholder='Password']").value;
        
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            const userDoc = await getDoc(doc(db, "users", user.uid));
            const userData = userDoc.data();

            sessionStorage.setItem("isLoggedIn", "true");
            sessionStorage.setItem("currentUser", userData?.username || email);

    await fetch('../php/log_login.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: userData?.username || email })
    });

            alert("Login successful! Welcome back!");
            window.location.href = "shop.html";

        } catch (error) {
            alert("Error: " + error.message);
        }
    });
}

// ==================== FORGOT PASSWORD ====================
const forgotForm = document.querySelector("#forgot-form");

if (forgotForm) {
    forgotForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = forgotForm.querySelector("input[type='email']").value.trim();

        try {
            await sendPasswordResetEmail(auth, email);
            alert("Password reset email sent! Check your inbox or Spam folder.");
        } catch (error) {
            alert("Error: " + error.message);
        }
    });
}

// ==================== LOGOUT ====================
const logoutBtn = document.querySelector("#logout-btn");

if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        await fetch('../php/log_logout.php', { method: 'POST' });
        await signOut(auth);
        window.location.replace("login.html");
    });
}

// ==================== INIT CAROUSEL ====================
document.addEventListener('DOMContentLoaded', () => {
    initCarousel();
});