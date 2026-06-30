import { auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Guard for protected pages - redirect to login if not authenticated
export function requireAuth(redirectTo = "login.html") {
    return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe();
            if (user) {
                resolve(user);
            } else {
                window.location.replace(redirectTo);
                resolve(null); // Resolve instead of reject for clean redirect
            }
        });
    });
}

// Guard for auth pages - redirect to shop if already authenticated
export function requireGuest(redirectTo = "shop.html") {
    return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe();
            if (!user) {
                resolve();
            } else {
                window.location.replace(redirectTo);
                resolve(); // Resolve instead of reject for clean redirect
            }
        });
    });
}