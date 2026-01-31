const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * Triggered when a new document is created in the 'notifications' collection.
 * Sends a Push Notification (FCM) to all users with a valid fcmToken.
 */
exports.sendBroadcastNotification = functions.firestore
    .document("notifications/{notifId}")
    .onCreate(async (snap, context) => {
        const data = snap.data();

        // Only send push for notifications of type 'info' or 'alert' created via Admin Broadcast
        if (!data.title || !data.message) {
            console.log("Notification missing title/message, skipping push.");
            return;
        }

        const payload = {
            notification: {
                title: data.title,
                body: data.message,
                // icon: 'https://avgflow-dd822.web.app/pwa-192x192.png', // Absolute URL usually better for FCM
            },
            data: {
                id: context.params.notifId,
                click_action: "FLUTTER_NOTIFICATION_CLICK" // Standard handler
            }
        };

        try {
            // 1. Get all users with fcmToken
            // Note: In a large scale app, you should duplicate tokens to a 'tokens' collection or use Topic Messaging.
            // For internal < 50 users, querying 'users' is fine.
            const usersSnap = await admin.firestore().collection("users").get();

            const tokens = [];
            usersSnap.forEach((doc) => {
                const userData = doc.data();
                if (userData.fcmToken) {
                    tokens.push(userData.fcmToken);
                }
            });

            if (tokens.length === 0) {
                console.log("No tokens found.");
                return;
            }

            console.log(`Found ${tokens.length} tokens. Sending...`);

            // 2. Send Multicast Message (limit 500 per batch, but we likely have < 500)
            const response = await admin.messaging().sendEachForMulticast({
                tokens: tokens,
                notification: {
                    title: data.title,
                    body: data.message
                },
                data: {
                    url: '/' // Open app home
                }
            });

            console.log(`${response.successCount} messages were sent successfully.`);

            if (response.failureCount > 0) {
                const failedTokens = [];
                response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        failedTokens.push(tokens[idx]);
                    }
                });
                console.log("List of tokens that caused failures: " + failedTokens);
            }

        } catch (error) {
            console.error("Error sending push notifications:", error);
        }
    });
