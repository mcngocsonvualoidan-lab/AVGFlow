import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyDfEtxQTXzxq_4P42VLWgoeZViD1C9Xw-E",
    authDomain: "avgflow-dd822.firebaseapp.com",
    projectId: "avgflow-dd822",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
    try {
        const userRef = doc(db, 'users', '6');
        const snap = await getDoc(userRef);
        console.log(JSON.stringify(snap.data()?.leaves, null, 2));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

run();
