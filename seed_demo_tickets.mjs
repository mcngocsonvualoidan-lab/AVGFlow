import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyDPLGY_V4-SMO1Z_F4FXQKN2nFcWgXS3EM",
    authDomain: "avgflow-dd822.firebaseapp.com",
    projectId: "avgflow-dd822",
    storageBucket: "avgflow-dd822.firebasestorage.app",
    messagingSenderId: "717390934498",
    appId: "1:717390934498:web:cc8c33b9addd0fd7ea9d57"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function generateTicketCode(category) {
    const prefixes = { 'label-bag': 'NTK', 'carton': 'CTN', 'social': 'SOC' };
    const prefix = prefixes[category] || 'TK';
    const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${prefix}-${timestamp}${random}`;
}

const tickets = [
    {
        category: 'label-bag',
        action: 'new',
        brandName: 'Trà Shan Tuyết Cổ Thụ',
        contactName: 'Nguyễn Thanh Tuyền',
        contactPhone: '0912345678',
        contactEmail: 'tuyennt@demo.com',
        contactAddress: '123 Nguyễn Huệ, Q.1, TP HCM',
        formData: {
            'Tên nhãn hàng': 'Trà Shan Tuyết Cổ Thụ',
            'Người đặt hàng': 'Nguyễn Thanh Tuyền',
            'Số điện thoại': '0912345678',
            'Email': 'tuyennt@demo.com',
            'Kích thước': '12x20cm',
            'Số lượng': '500 túi',
            'Ý tưởng / Ghi chú thêm': 'Thiết kế nhãn túi trà cao cấp, phong cách truyền thống Việt Nam, gam màu xanh rêu + vàng đồng',
        },
        imageUrls: [],
    },
    {
        category: 'carton',
        action: 'edit',
        brandName: 'Mật Ong Rừng Tây Bắc',
        contactName: 'Trà My',
        contactPhone: '0987654321',
        contactEmail: 'tramy@demo.com',
        contactAddress: '45 Lê Lợi, Q.3, TP HCM',
        formData: {
            'Tên đơn vị đặt hàng': 'Mật Ong Rừng Tây Bắc',
            'Người đặt hàng': 'Trà My',
            'Số điện thoại': '0987654321',
            'Email': 'tramy@demo.com',
            'Kích thước thùng': '30x25x20cm',
            'Số lượng': '200 thùng',
            'Ý tưởng / Ghi chú thêm': 'Chỉnh sửa thùng carton hiện tại, thêm logo mới và thay đổi bố cục mặt trước',
        },
        imageUrls: [],
    },
    {
        category: 'social',
        action: 'new',
        brandName: 'Cà Phê Đà Lạt Premium',
        contactName: 'Đỗ Chiều',
        contactPhone: '0909876543',
        contactEmail: 'chieudo@demo.com',
        contactAddress: '78 Trần Hưng Đạo, Q.5, TP HCM',
        formData: {
            'Tên nhãn hàng / Fanpage': 'Cà Phê Đà Lạt Premium',
            'Người đặt hàng': 'Đỗ Chiều',
            'Số điện thoại': '0909876543',
            'Email': 'chieudo@demo.com',
            'Ý tưởng / Ghi chú thêm': 'Thiết kế banner quảng cáo Facebook + Instagram cho chiến dịch ra mắt sản phẩm mới, kích thước 1200x628 (FB) và 1080x1080 (IG)',
            'Link tài nguyên thiết kế': 'https://drive.google.com/demo-link',
        },
        imageUrls: [],
    },
];

const CATEGORY_LABELS = { 'label-bag': 'Nhãn / Túi', 'carton': 'Thùng Carton', 'social': 'Social Media' };
const ACTION_LABELS = { 'edit': 'Chỉnh sửa', 'new': 'Tạo mới' };

async function seed() {
    console.log('🚀 Seeding demo tickets...\n');

    for (const ticket of tickets) {
        const ticketCode = generateTicketCode(ticket.category);
        const description = Object.entries(ticket.formData)
            .filter(([, v]) => v)
            .map(([k, v]) => `${k}: ${v}`)
            .join('\n');

        const ticketData = {
            ...ticket,
            ticketCode,
            description,
            status: 'open',
            revisionRound: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            completedAt: null,
        };

        try {
            const docRef = await addDoc(collection(db, 'design_tickets'), ticketData);
            console.log(`✅ Ticket ${ticketCode} created (ID: ${docRef.id})`);
            console.log(`   📦 Category: ${CATEGORY_LABELS[ticket.category]} — ${ACTION_LABELS[ticket.action]}`);
            console.log(`   🏷️  Brand: ${ticket.brandName}`);
            console.log(`   👤 Contact: ${ticket.contactName} (${ticket.contactPhone})`);

            // Auto welcome message
            await addDoc(collection(db, 'design_tickets', docRef.id, 'messages'), {
                text: `🎉 Ticket ${ticketCode} đã được tạo thành công!\n\nLoại: ${CATEGORY_LABELS[ticket.category]} — ${ACTION_LABELS[ticket.action]}\nThương hiệu: ${ticket.brandName}\n\nAdmin sẽ liên hệ bạn sớm nhất qua chat này. Hãy theo dõi ticket để cập nhật tiến độ!`,
                sender: 'Hệ thống',
                senderRole: 'admin',
                createdAt: serverTimestamp(),
            });
            console.log(`   💬 Welcome message sent\n`);
        } catch (err) {
            console.error(`❌ Failed to create ticket for ${ticket.brandName}:`, err.message);
        }
    }

    console.log('🎉 Done! Check https://flow.auvietglobal.com/public/orders');
    process.exit(0);
}

seed();
