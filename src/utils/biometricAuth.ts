/**
 * Biometric Authentication using Web Authentication API (WebAuthn)
 * Supports: Fingerprint, Face ID, Iris Scan, PIN/Passcode
 */

const BIOMETRIC_CREDENTIAL_KEY = 'avgflow_biometric_credential';
const BIOMETRIC_ENABLED_KEY = 'avgflow_biometric_enabled';
const BIOMETRIC_USER_KEY = 'avgflow_biometric_user';

// Check if WebAuthn is supported
export const isWebAuthnSupported = (): boolean => {
    return !!(window.PublicKeyCredential &&
        navigator.credentials &&
        typeof navigator.credentials.create === 'function');
};

// Check if platform authenticator (biometric) is available
export const isPlatformAuthenticatorAvailable = async (): Promise<boolean> => {
    if (!isWebAuthnSupported()) return false;

    try {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        return available;
    } catch (error) {
        console.error('Error checking platform authenticator:', error);
        return false;
    }
};

// Check if biometric is enabled for current device
export const isBiometricEnabled = (): boolean => {
    return localStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true';
};

// Get stored biometric user email
export const getBiometricUser = (): string | null => {
    return localStorage.getItem(BIOMETRIC_USER_KEY);
};

// Generate a random challenge
const generateChallenge = (): Uint8Array => {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);
    return challenge;
};

// Convert ArrayBuffer to Base64
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
};

// Convert Base64 to ArrayBuffer
const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
};

// Register biometric credential for user
export const registerBiometric = async (userEmail: string, userName: string): Promise<boolean> => {
    if (!isWebAuthnSupported()) {
        throw new Error('WebAuthn không được hỗ trợ trên thiết bị này.');
    }

    const available = await isPlatformAuthenticatorAvailable();
    if (!available) {
        throw new Error('Thiết bị không hỗ trợ xác thực sinh trắc học.');
    }

    try {
        const challenge = generateChallenge();
        const userId = new TextEncoder().encode(userEmail);

        const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
            challenge: challenge.buffer as ArrayBuffer,
            rp: {
                name: 'AVGFlow System',
                id: window.location.hostname,
            },
            user: {
                id: userId.buffer as ArrayBuffer,
                name: userEmail,
                displayName: userName || userEmail,
            },
            pubKeyCredParams: [
                { alg: -7, type: 'public-key' },   // ES256
                { alg: -257, type: 'public-key' }, // RS256
            ],
            authenticatorSelection: {
                authenticatorAttachment: 'platform', // Use device biometric
                userVerification: 'required',        // Require biometric verification
                residentKey: 'preferred',
            },
            timeout: 60000,
            attestation: 'none',
        };

        const credential = await navigator.credentials.create({
            publicKey: publicKeyCredentialCreationOptions,
        }) as PublicKeyCredential;

        if (!credential) {
            throw new Error('Không thể tạo credential sinh trắc học.');
        }

        // Store credential ID for later verification
        const credentialId = arrayBufferToBase64(credential.rawId);
        localStorage.setItem(BIOMETRIC_CREDENTIAL_KEY, credentialId);
        localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
        localStorage.setItem(BIOMETRIC_USER_KEY, userEmail);

        return true;
    } catch (error: any) {
        console.error('Biometric registration error:', error);

        if (error.name === 'NotAllowedError') {
            throw new Error('Người dùng đã hủy xác thực sinh trắc học.');
        }
        if (error.name === 'SecurityError') {
            throw new Error('Lỗi bảo mật. Vui lòng sử dụng HTTPS.');
        }

        throw error;
    }
};

// Authenticate using biometric
export const authenticateWithBiometric = async (): Promise<{ success: boolean; userEmail: string | null }> => {
    if (!isWebAuthnSupported()) {
        throw new Error('WebAuthn không được hỗ trợ trên thiết bị này.');
    }

    const credentialIdBase64 = localStorage.getItem(BIOMETRIC_CREDENTIAL_KEY);
    if (!credentialIdBase64) {
        throw new Error('Chưa đăng ký sinh trắc học trên thiết bị này.');
    }

    try {
        const challenge = generateChallenge();
        const credentialId = base64ToArrayBuffer(credentialIdBase64);

        const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
            challenge: challenge.buffer as ArrayBuffer,
            allowCredentials: [
                {
                    id: credentialId,
                    type: 'public-key',
                    transports: ['internal'],
                },
            ],
            userVerification: 'required',
            timeout: 60000,
            rpId: window.location.hostname,
        };

        const assertion = await navigator.credentials.get({
            publicKey: publicKeyCredentialRequestOptions,
        }) as PublicKeyCredential;

        if (!assertion) {
            return { success: false, userEmail: null };
        }

        // Verification successful
        const userEmail = localStorage.getItem(BIOMETRIC_USER_KEY);
        return { success: true, userEmail };
    } catch (error: any) {
        console.error('Biometric authentication error:', error);

        if (error.name === 'NotAllowedError') {
            throw new Error('Xác thực bị hủy hoặc thất bại.');
        }
        if (error.name === 'SecurityError') {
            throw new Error('Lỗi bảo mật.');
        }

        throw error;
    }
};

// Disable biometric authentication
export const disableBiometric = (): void => {
    localStorage.removeItem(BIOMETRIC_CREDENTIAL_KEY);
    localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
    localStorage.removeItem(BIOMETRIC_USER_KEY);
};

// Get biometric type name based on platform
export const getBiometricTypeName = (): string => {
    const ua = navigator.userAgent.toLowerCase();

    if (/iphone|ipad|ipod/.test(ua)) {
        return 'Face ID / Touch ID';
    }
    if (/android/.test(ua)) {
        return 'Vân tay / Khuôn mặt';
    }
    if (/windows/.test(ua)) {
        return 'Windows Hello';
    }
    if (/mac/.test(ua)) {
        return 'Touch ID';
    }

    return 'Sinh trắc học';
};
