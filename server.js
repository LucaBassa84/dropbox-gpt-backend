const express = require('express');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());

const DROPBOX_TOKEN = process.env.DROPBOX_TOKEN;

function ext(name = '') {
  const n = name.toLowerCase();
  if (n.endsWith('.pdf')) return 'pdf';
  if (n.endsWith('.docx')) return 'docx';
  if (n.endsWith('.doc')) return 'doc';
  if (n.endsWith('.txt')) return 'txt';
  if (n.endsWith('.md')) return 'md';
  return 'bin';
}

function contentType(fileName = '') {
  const e = ext(fileName);
  if (e === 'pdf') return 'application/pdf';
  if (e === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (e === 'doc') return 'application/msword';
  if (e === 'txt' || e === 'md') return 'text/plain; charset=utf-8';
  return 'application/octet-stream';
}

app.get('/', (req, res) => {
  res.send('Server attivo');
});

app.get('/files', async (req, res) => {
  try {
    const folder = req.query.path || '';
    const response = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
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

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/find-first-match', async (req, res) => {
  try {
    const { folder, q } = req.query;

    if (!folder || !q) {
      return res.status(400).json({ error: "Parametri 'folder' e 'q' obbligatori" });
    }

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
      return res.status(500).json({ error: 'Errore nel recupero file', details: listData });
    }

    const file = listData.entries.find(f =>
      f[".tag"] === "file" &&
      f.name &&
      f.name.toLowerCase().includes(q.toLowerCase())
    );

    if (!file) {
      return res.status(404).json({
        error: 'File non trovato nella cartella indicata',
        folder,
        query: q
      });
    }

    res.json({
      name: file.name,
      path_display: file.path_display,
      path_lower: file.path_lower,
      id: file.id,
      tag: file[".tag"]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/read-first-match', async (req, res) => {
  try {
    const { folder, q } = req.query;

    if (!folder || !q) {
      return res.status(400).json({ error: "Parametri 'folder' e 'q' obbligatori" });
    }

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
      return res.status(500).json({ error: 'Errore nel recupero file', details: listData });
    }

    const file = listData.entries.find(f =>
      f[".tag"] === "file" &&
      f.name &&
      f.name.toLowerCase().includes(q.toLowerCase())
    );

    if (!file) {
      return res.status(404).json({
        error: 'File non trovato nella cartella indicata',
        folder,
        query: q
      });
    }

    const downloadRef = file.path_lower || file.path_display || file.id;

    const downloadResponse = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DROPBOX_TOKEN}`,
        'Dropbox-API-Arg': JSON.stringify({
          path: downloadRef
        })
      }
    });

    if (!downloadResponse.ok) {
      const errText = await downloadResponse.text();
      return res.status(500).send(errText);
    }

    const buffer = await downloadResponse.buffer();

    res.setHeader('Content-Type', contentType(file.name));
    res.setHeader('Content-Disposition', `inline; filename="${file.name}"`);
    res.send(buffer);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server attivo sulla porta ${PORT}`);
});
