import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
    apiKey: "AIzaSyDfEtxQTXzxq_4P42VLWgoeZViD1C9Xw-E",
    authDomain: "avgflow-dd822.firebaseapp.com",
    projectId: "avgflow-dd822",
    storageBucket: "avgflow-dd822.firebasestorage.app",
    messagingSenderId: "210885567448",
    appId: "1:210885567448:web:c9b7d5a1471ad06565c8ad",
    measurementId: "G-F705612L4C",
    databaseURL: "https://avgflow-dd822-default-rtdb.asia-southeast1.firebasedatabase.app"
};

import { getStorage } from "firebase/storage";
import { getMessaging } from "firebase/messaging";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const realtimeDb = getDatabase(app);
export const storage = getStorage(app);
export const messaging = getMessaging(app);
// const analytics = getAnalytics(app);
