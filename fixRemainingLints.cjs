const fs = require('fs');

function fixForm() {
    let code = fs.readFileSync('src/modules/orders/DesignOrderForm.tsx', 'utf-8');
    code = code.replace(/import \{ supabase \} from '\.\.\/\.\.\/lib\/supabase';\n/, '');
    code = code.replace(/interface ChatMessage \{[\s\S]*?\}\n/, '');
    fs.writeFileSync('src/modules/orders/DesignOrderForm.tsx', code);
}

function fixPopup() {
    let code = fs.readFileSync('src/modules/orders/DesignTicketPopup.tsx', 'utf-8');
    code = code.replace(/setChatErr\(/g, 'console.error(');
    fs.writeFileSync('src/modules/orders/DesignTicketPopup.tsx', code);
}

fixForm();
fixPopup();
