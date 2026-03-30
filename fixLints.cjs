const fs = require('fs');

function fixDesignOrderForm() {
    let code = fs.readFileSync('src/modules/orders/DesignOrderForm.tsx', 'utf-8');
    // Remove unused lucide-react icons
    code = code.replace(/Send, /g, '');
    code = code.replace(/MessageCircle, /g, '');
    // Remove unused supabase import
    code = code.replace(/import \{ supabase \} from '\.\.\/\.\.\/lib\/supabase';\n/, '');
    // Remove unused ChatMessage interface
    code = code.replace(/interface ChatMessage \{[\s\S]*?\}\n/, '');
    fs.writeFileSync('src/modules/orders/DesignOrderForm.tsx', code);
}

function fixDesignTicketPopup() {
    let code = fs.readFileSync('src/modules/orders/DesignTicketPopup.tsx', 'utf-8');
    // Remove unused lucide-react icons
    code = code.replace(/Send, /g, '');
    code = code.replace(/Paperclip, /g, '');
    code = code.replace(/MessageCircle, /g, '');
    code = code.replace(/Download, /g, '');
    // Remove unused r2UploadService import
    code = code.replace(/import \{ uploadFileToR2 \} from '\.\.\/\.\.\/services\/r2UploadService';\n/, '');
    // Remove unused ADMIN_NAMES
    code = code.replace(/const ADMIN_NAMES: Record<string, string> = \{[\s\S]*?\};\n/, '');
    // Remove unused states
    code = code.replace(/    const \[rightTab, setRightTab\] = useState<'chat' \| 'timeline'>\('chat'\);\n/, '');
    code = code.replace(/    const \[newMsg, setNewMsg\] = useState\(''\);\n/, '');
    code = code.replace(/    const \[sending, setSending\] = useState\(false\);\n/, '');
    code = code.replace(/    const \[chatErr, setChatErr\] = useState\(''\);\n/, '');
    code = code.replace(/    const fileRef = useRef<HTMLInputElement>\(null\);\n/, '');
    fs.writeFileSync('src/modules/orders/DesignTicketPopup.tsx', code);
}

fixDesignOrderForm();
fixDesignTicketPopup();
