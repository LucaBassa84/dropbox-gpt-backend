const express = require('express');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());

const DROPBOX_TOKEN = process.env.DROPBOX_TOKEN;

app.get('/', (req, res) => {
  res.send('Server attivo');
});

app.get('/files', async (req, res) => {
  try {
    const response = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DROPBOX_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path: "",
        recursive: false
      })
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).send('Errore');
  }
});

app.listen(3000, () => {
  console.log('Server avviato');
}); 
