const express = require('express');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());

const DROPBOX_TOKEN = process.env.DROPBOX_TOKEN;

// TEST SERVER
app.get('/', (req, res) => {
  res.send('Server attivo');
});


// LISTA FILE
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
    res.status(500).json({ error: error.message });
  }
});


// LEGGI FILE PER ID (CORRETTO)
app.get('/read', async (req, res) => {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: "Parametro 'id' mancante" });
    }

    const response = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DROPBOX_TOKEN}`,
        'Dropbox-API-Arg': JSON.stringify({
          path: `id:${id}`
        })
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(500).send(errText);
    }

    const buffer = await response.buffer();

    // 🔥 QUESTO È IL FIX IMPORTANTE
    res.setHeader('Content-Type', 'application/pdf');
    res.send(buffer);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// CERCA E APRE IL PRIMO FILE (CORRETTO)
app.get('/read-first-match', async (req, res) => {
  try {
    const { folder, q } = req.query;

    if (!folder || !q) {
      return res.status(400).json({ error: "Parametri 'folder' e 'q' obbligatori" });
    }

    // 1. Lista file nella cartella
    const listResponse = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DROPBOX_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path: folder,
        recursive: false
      })
    });

    const listData = await listResponse.json();

    if (!listData.entries) {
      return res.status(500).json({ error: "Errore nel recupero file" });
    }

    // 2. Trova primo file che contiene la parola
    const file = listData.entries.find(f =>
      f[".tag"] === "file" &&
      f.name.toLowerCase().includes(q.toLowerCase())
    );

    if (!file) {
      return res.status(404).json({
        error: "File non trovato nella cartella indicata",
        folder,
        query: q
      });
    }

    // 3. Scarica file tramite ID
    const downloadResponse = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DROPBOX_TOKEN}`,
        'Dropbox-API-Arg': JSON.stringify({
          path: `id:${file.id}`
        })
      }
    });

    if (!downloadResponse.ok) {
      const errText = await downloadResponse.text();
      return res.status(500).send(errText);
    }

    const buffer = await downloadResponse.buffer();

    // 🔥 FIX: mostra PDF correttamente
    res.setHeader('Content-Type', 'application/pdf');
    res.send(buffer);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// AVVIO SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server attivo sulla porta ${PORT}`);
});
