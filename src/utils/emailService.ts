import { getFirestore, collection, addDoc } from 'firebase/firestore';

export const sendInviteEmail = async (user: { name: string; email: string }) => {
    try {
        // 1. Fetch template from public folder
        const response = await fetch('/email_preview_invite_v2.html');
        if (!response.ok) {
            throw new Error('Failed to load email template');
        }
        let htmlContent = await response.text();

        // 2. Replace placeholders
        htmlContent = htmlContent.replace(/\[Tên Nhân Sự\]/g, user.name);
        htmlContent = htmlContent.replace(/\[email.cuaban@gmail.com\]/g, user.email);

        // 3. Queue email in Firestore 'mail' collection
        const db = getFirestore();
        await addDoc(collection(db, 'mail'), {
            to: user.email,
            from: "Au Viet Global <admin@auvietglobal.com>", // Verified Sender
            message: {
                subject: "✨ Mời tham gia hệ thống AVG Flow",
                html: htmlContent
            }
        });

        return { success: true };
    } catch (error: any) {
        console.error("Send invite failed:", error);
        return { success: false, error: error.message };
    }
};
