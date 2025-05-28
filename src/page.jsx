'use client';

import { useState } from 'react';
import mammoth from 'mammoth';
import { saveAs } from 'file-saver';
import { Document, Packer, Paragraph, TextRun } from 'docx';

export default function Home() {
  const [placeholders, setPlaceholders] = useState({});
  const [originalText, setOriginalText] = useState('');
  const [fileName, setFileName] = useState('');

  const handleUpload = async (event) => {
    const file = event.target.files[0];
    setFileName(file.name.replace('.docx', '_modificado.docx'));

    const arrayBuffer = await file.arrayBuffer();
    const { value } = await mammoth.convertToHtml({ arrayBuffer });

    setOriginalText(value);

    const matches = [...value.matchAll(/\{\{(.*?)\}\}/g)];
    const fields = {};
    matches.forEach((m) => {
      const key = m[1].trim();
      if (!(key in fields)) fields[key] = '';
    });
    setPlaceholders(fields);
  };

  const handleChange = (key, value) => {
    setPlaceholders({ ...placeholders, [key]: value });
  };

  const generateDocx = () => {
    const replacedText = originalText.replace(/\{\{(.*?)\}\}/g, (_, key) => {
      const k = key.trim();
      return placeholders[k] || '';
    });

    const doc = new Document({
      sections: [
        {
          children: replacedText.split('\n').map(
            (line) =>
              new Paragraph({
                children: [new TextRun(line)],
              })
          ),
        },
      ],
    });

    Packer.toBlob(doc).then((blob) => {
      saveAs(blob, fileName);
    });
  };

  return (
    <main className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Reemplazador de informes .docx</h1>

      <input type="file" accept=".docx" onChange={handleUpload} className="mb-4" />

      {Object.keys(placeholders).length > 0 && (
        <div className="space-y-4">
          {Object.entries(placeholders).map(([key, value]) => (
            <div key={key}>
              <label className="block font-medium">{key}</label>
              <input
                type="text"
                value={value}
                onChange={(e) => handleChange(key, e.target.value)}
                className="border p-2 rounded w-full"
              />
            </div>
          ))}

          <button
            onClick={generateDocx}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Descargar documento modificado
          </button>
        </div>
      )}
    </main>
  );
}
