const R2_WORKER_URL = 'https://avgflow-r2-upload.mcngocsonvualoidan.workers.dev';
async function test() {
  try {
    const blob = new Blob(['hello world'], { type: 'application/pdf' });
    const response = await fetch(R2_WORKER_URL + '/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/pdf',
        'X-File-Name': 'test.pdf',
        'X-Folder': 'design_tickets'
      },
      body: blob
    });
    console.log(response.status);
    console.log(await response.text());
  } catch(e) {
    console.error(e);
  }
}
test();
