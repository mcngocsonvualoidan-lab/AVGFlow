/**
 * ============================================
 * 📚 External Libraries - Barrel Export
 * ============================================
 * Central export file for all external library initializations
 */

// Firebase
export { auth, googleProvider, db, realtimeDb, storage, messaging } from './firebase';

// Supabase
export { supabase } from './supabase';

// Google Gemini AI
export { getGeminiKey, saveGeminiKey, initializeGemini, streamGeminiResponse } from './gemini';

