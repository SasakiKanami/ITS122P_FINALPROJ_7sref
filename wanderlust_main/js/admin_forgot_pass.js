import { auth, db } from "./firebase-config.js";
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const form = document.getElementById("admin-forgot-form");
const resetEmail = document.getElementById("admin-reset-email");
const submitBtn = document.getElementById("submit-btn");
const resendBtn = document.getElementById("resend-btn");
const resendSection = document.getElementById("resend-section");
const errorMessage = document.getElementById("error-message");

let countdown;

function startTimer() {
    let seconds = 60;
    resendSection.style.display = "block";
    resendBtn.disabled = true;
    resendBtn.innerHTML = `Resend in <span id="timer">${seconds}</span>s`;

    countdown = setInterval(() => {
        seconds--;
        document.getElementById("timer").textContent = seconds;

        if (seconds <= 0) {
            clearInterval(countdown);
            resendBtn.disabled = false;
            resendBtn.textContent = "Resend Email";
        }
    }, 1000);
}

async function sendReset() {
    const email = resetEmail.value.trim();
    errorMessage.textContent = "";

    if (!email) {
        errorMessage.textContent = "Please enter your email address.";
        return;
    }

    const isAdminEmail = await isAdminUserEmail(email);
    if (!isAdminEmail) {
        errorMessage.textContent = "This email is not authorized for admin password reset.";
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Sending...";
    try {
        await sendPasswordResetEmail(auth, email);
        alert("Password reset email sent! Check your inbox.");
        submitBtn.textContent = "Email Sent!";
        startTimer();
    } catch (error) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Send Reset Link";

        switch (error.code) {
            case 'auth/too-many-requests':
                errorMessage.textContent = "Too many attempts. Please wait a few minutes before trying again.";
                break;
            case 'auth/user-not-found':
                errorMessage.textContent = "No account found with this email address.";
                break;
            case 'auth/invalid-email':
                errorMessage.textContent = "Please enter a valid email address.";
                break;
            default:
                errorMessage.textContent = "Error: " + error.message;
        }
    }
}

async function isAdminUserEmail(email) {
    const q = query(
        collection(db, "users"),
        where("email", "==", email),
        where("isAdmin", "==", true)
    );
    const snapshot = await getDocs(q);
    return !snapshot.empty;
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    await sendReset();
});

resendBtn.addEventListener("click", async () => {
    clearInterval(countdown);
    resendBtn.textContent = "Sending...";
    await sendReset();
});
