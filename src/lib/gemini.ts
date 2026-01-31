import { GoogleGenerativeAI } from "@google/generative-ai";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

let genAI: GoogleGenerativeAI | null = null;
let model: any = null;
let cachedKey: string | null = null;

export const getGeminiKey = async () => {
    if (cachedKey) return cachedKey;
    try {
        const docRef = doc(db, 'system', 'gemini_config');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            cachedKey = docSnap.data().apiKey;
            return cachedKey;
        }
    } catch (e) {
        console.error("Failed to fetch Gemini Key", e);
    }
    return null;
};

export const saveGeminiKey = async (key: string) => {
    await setDoc(doc(db, 'system', 'gemini_config'), { apiKey: key }, { merge: true });
    cachedKey = key;
    genAI = null; // Reset to re-init
    model = null;
};

export const initializeGemini = async (providedKey?: string) => {
    if (model && !providedKey) return model;

    const apiKey = providedKey || await getGeminiKey();

    if (!apiKey) {
        return null;
    }

    try {
        genAI = new GoogleGenerativeAI(apiKey);
        model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
        return model;
    } catch (e) {
        console.error("Init Gemini Failed", e);
        return null;
    }
};

export const streamGeminiResponse = async (
    msg: string,
    history: { role: 'user' | 'model', parts: { text: string }[] }[],
    onToken: (text: string) => void
) => {
    const aiModel = await initializeGemini();
    if (!aiModel) throw new Error("API_KEY_MISSING");

    try {
        const chat = aiModel.startChat({
            history: history,
        });

        const result = await chat.sendMessageStream(msg);

        for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            onToken(chunkText);
        }
    } catch (error) {
        console.error("Gemini Stream Error:", error);
        throw error;
    }
};
