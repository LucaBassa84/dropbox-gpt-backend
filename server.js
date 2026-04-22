const express = require('express');
const fetch = require('node-fetch');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');

const app = express();
app.use(express.json());

const DROPBOX_TOKEN = process.env.DROPBOX_TOKEN;

function dropboxApi(path, body) {
  return fetch(`https://api.dropboxapi.com/2/${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DROPBOX_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
}

function dropboxContentApi(path, apiArg) {
  return fetch(`https://content.dropboxapi.com/2/${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DROPBOX_TOKEN}`,
      'Dropbox-API-Arg': JSON.stringify(apiArg)
    }
  });
}

app.get('/', (req, res) => {
  res.send('Server attivo');
});

app.get('/files', async (req, res) => {
  try {
    const path = req.query.path || '';
    const response = await dropboxApi('files/list_folder', {
      path,
      recursive: false
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Errore nel recupero file', details: error.message });
  }
});

app.get('/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ error: 'Parametro q mancante' });
    }

    const response = await dropboxApi('files/search_v2', {
      query,
      options: {
        filename_only: true,
        max_results: 20
      }
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Errore nella ricerca', details: error.message });
  }
});

app.get('/read', async (req, res) => {
  try {
    const path = req.query.path;
    if (!path) {
      return res.status(400).json({ error: 'Parametro path mancante' });
    }

    const response = await dropboxContentApi('files/download', { path });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: 'Errore download file', details: text });
    }

    const buffer = await response.buffer();
    const lowerPath = path.toLowerCase();

    if (lowerPath.endsWith('.txt') || lowerPath.endsWith('.md')) {
      return res.json({
        path,
        type: 'text',
        content: buffer.toString('utf8')
      });
    }

    if (lowerPath.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ buffer });
      return res.json({
        path,
        type: 'docx',
        content: result.value
      });
    }

    if (lowerPath.endsWith('.pdf')) {
      const result = await pdfParse(buffer);
      return res.json({
        path,
        type: 'pdf',
        content: result.text
      });
    }

    return res.json({
      path,
      type: 'unsupported',
      content: 'Formato non ancora supportato per lettura testuale automatica'
    });
  } catch (error) {
    res.status(500).json({ error: 'Errore lettura file', details: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server avviato sulla porta ${PORT}`);
});
