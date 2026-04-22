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

async function readDropboxFile(filePath, fileName) {
  const downloadResponse = await dropboxContentApi('files/download', { path: filePath });

  if (!downloadResponse.ok) {
    const text = await downloadResponse.text();
    throw new Error(`Errore download file: ${text}`);
  }

  const buffer = await downloadResponse.buffer();
  const lowerName = fileName.toLowerCase();

  if (lowerName.endsWith('.txt') || lowerName.endsWith('.md')) {
    return {
      file: fileName,
      path: filePath,
      type: 'text',
      content: buffer.toString('utf8')
    };
  }

  if (lowerName.endsWith('.docx')) {
    const result = await mammoth.extractRawText({ buffer });
    return {
      file: fileName,
      path: filePath,
      type: 'docx',
      content: result.value
    };
  }

  if (lowerName.endsWith('.pdf')) {
    const result = await pdfParse(buffer);
    return {
      file: fileName,
      path: filePath,
      type: 'pdf',
      content: result.text
    };
  }

  return {
    file: fileName,
    path: filePath,
    type: 'unsupported',
    content: 'Formato non ancora supportato per lettura testuale automatica'
  };
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

app.get('/read-first-match', async (req, res) => {
  try {
    const folder = req.query.folder;
    const q = req.query.q;

    if (!folder || !q) {
      return res.status(400).json({ error: 'Servono i parametri folder e q' });
    }

    const response = await dropboxApi('files/list_folder', {
      path: folder,
      recursive: false
    });

    const data = await response.json();

    if (!data.entries || !Array.isArray(data.entries)) {
      return res.status(500).json({ error: 'Risposta Dropbox non valida', details: data });
    }

    const found = data.entries.find(entry =>
      entry[".tag"] === "file" &&
      entry.name &&
      entry.name.toLowerCase().includes(q.toLowerCase())
    );

    if (!found) {
      return res.status(404).json({
        error: 'Nessun file trovato con quel testo nel nome',
        folder,
        q
      });
    }

    const filePath = found.path_lower || found.path_display;
    const result = await readDropboxFile(filePath, found.name);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Errore lettura file', details: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server avviato sulla porta ${PORT}`);
});
