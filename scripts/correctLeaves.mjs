import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, updateDoc } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyDfEtxQTXzxq_4P42VLWgoeZViD1C9Xw-E",
    authDomain: "avgflow-dd822.firebaseapp.com",
    projectId: "avgflow-dd822",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
    console.log("Starting leave correction...");
    try {
        const userRef = doc(db, 'users', '6');
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const data = userSnap.data();
            let leaves = data.leaves || [];

            // Adjust Feb 10 (was absence because "out of quota", but it's earlier)
            const feb10Index = leaves.findIndex(l => l.start.startsWith('2026-02-10'));
            if (feb10Index !== -1) {
                // Change to paid leave
                leaves[feb10Index].type = 'leave';
                leaves[feb10Index].reason = 'Việc gia đình';
            }

            // Adjust Feb 26 (was leave, but it's later so it should be absence)
            const feb26Index = leaves.findIndex(l => l.start.startsWith('2026-02-26'));
            if (feb26Index !== -1) {
                // Change to absence
                leaves[feb26Index].type = 'absence';
                leaves[feb26Index].reason = 'Nghỉ phép (Hết phép -> KP)';
            }

            await updateDoc(userRef, { leaves: leaves });
            console.log("Updated user 6 leaves correctly based on date.");
        } else {
            console.log("User 6 not found");
        }

    } catch (e) {
        console.error("Error updating:", e);
    }
    process.exit(0);
}

run();
