import { auth, db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

export async function isAdminUser(user) {
  if (!user) return false;

  const userDoc = await getDoc(doc(db, "users", user.uid));
  const userData = userDoc.data();
  return userData?.isAdmin === true;
}

export function onAdminStateChanged(onAuthorized, onUnauthorized = 'admin_login.html') {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = onUnauthorized;
      return;
    }

    const userDoc = await getDoc(doc(db, "users", user.uid));
    const userData = userDoc.data();
    const isAdmin = userData?.isAdmin === true;

    if (!isAdmin) {
      window.location.href = onUnauthorized;
      return;
    }

    onAuthorized(user, userData);
  });
}
