const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();
const rtdb = admin.database();

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
                icon: 'https://avgflow-dd822.web.app/pwa-192x192.png',
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

/**
 * Triggered when a new chat message is added to RTDB.
 * Sends push notifications to other participants in the room.
 */
exports.onNewChatMessage = functions.database
    .ref("/chatMessages/{roomId}/{msgId}")
    .onWrite(async (change, context) => {
        // Only trigger on creation
        if (!change.after.exists() || change.before.exists()) return;

        const msgData = change.after.val();
        const roomId = context.params.roomId;
        const senderId = msgData.senderId;

        // Skip system messages or if missing critical info
        if (senderId === 'system' || !msgData.text) return;

        try {
            // 1. Get room details to find participants
            const roomSnap = await rtdb.ref(`chatRooms/${roomId}`).once('value');
            if (!roomSnap.exists()) return;

            const roomData = roomSnap.val();
            const participants = Object.keys(roomData.participants || {});
            const chatName = roomData.type === 'group' ? roomData.groupName : 'Tin nhắn mới';

            // 2. Filter out the sender
            const recipients = participants.filter(uid => uid !== senderId);
            if (recipients.length === 0) return;

            // 3. Get sender's name for the notification
            // We need to look up in Firestore users
            const senderSnap = await db.collection("users").doc(senderId).get();
            const senderName = senderSnap.exists ? senderSnap.data().name : 'Đồng nghiệp';

            const title = roomData.type === 'group' ? `[${chatName}] ${senderName}` : senderName;
            const body = msgData.type === 'text' ? msgData.text : (msgData.type === 'image' ? '[Hình ảnh]' : '[Tập tin]');

            // 4. Collect tokens for recipients
            const tokens = [];
            for (const uid of recipients) {
                const userDoc = await db.collection("users").doc(uid).get();
                if (userDoc.exists && userDoc.data().fcmToken) {
                    tokens.push(userDoc.data().fcmToken);
                }
            }

            if (tokens.length === 0) {
                console.log("No recipient tokens found.");
                return;
            }

            console.log(`Sending chat push to ${tokens.length} tokens for room ${roomId}`);

            // 5. Send notifications
            await admin.messaging().sendEachForMulticast({
                tokens: tokens,
                notification: {
                    title: title,
                    body: body
                },
                data: {
                    url: '/dashboard', // Can be refined to deep link to specific chat
                    type: 'chat',
                    roomId: roomId
                }
            });

        } catch (error) {
            console.error("Error in onNewChatMessage trigger:", error);
        }
    });
