import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hbcfslgxosdzlfuljxxn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_RZmqGM8T25niehlC2NgIqg_oTrtnOcR';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
  const { data: tickets } = await supabase.from('design_tickets').select('id').limit(1);
  if (!tickets || tickets.length === 0) return console.log('No tickets');
  
  const ticketId = tickets[0].id;
  const { data, error } = await supabase.from('ticket_messages').insert({
      ticket_id: ticketId,
      text: 'Test file',
      sender: 'Test Sender',
      sender_role: 'customer',
      sender_email: null,
      image_url: 'https://avgflow-r2-upload.mcngocsonvualoidan.workers.dev/file/design_tickets/test.pdf',
  }).select('*');
  console.log('Error:', error);
  console.log('Data:', data);
}

test();
