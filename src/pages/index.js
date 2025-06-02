'use client';

import { useState } from 'react';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export default function Home() {
  const [fields, setFields] = useState({});
  const [docxFile, setDocxFile] = useState(null);

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    setDocxFile(file);

    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const documentXml = await zip.file("word/document.xml").async("string");

    const matches = [...documentXml.matchAll(/\{\{(.*?)\}\}/g)];
    const uniqueFields = [...new Set(matches.map(m => m[1].trim()))];

    const fieldsObj = {};
    uniqueFields.forEach(field => {
      fieldsObj[field] = '';
    });

    setFields(fieldsObj);
  };

  const handleChange = (e, key) => {
    setFields({ ...fields, [key]: e.target.value });
  };

  const handleDownload = async () => {
    const arrayBuffer = await docxFile.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    let documentXml = await zip.file("word/document.xml").async("string");

    for (const key in fields) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      documentXml = documentXml.replace(regex, fields[key]);
    }

    zip.file("word/document.xml", documentXml);
    const newBlob = await zip.generateAsync({ type: "blob" });
    saveAs(newBlob, "reemplazado.docx");
  };

  return (
    <main className="p-4 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Reemplazo de campos en DOCX</h1>
      <input type="file" accept=".docx" onChange={handleFileChange} />
      {Object.keys(fields).length > 0 && (
        <div className="mt-4 space-y-2">
          {Object.entries(fields).map(([key, value]) => (
            <div key={key}>
              <label className="block text-sm font-medium">{key}</label>
              <input
                className="w-full p-2 border border-gray-300 rounded"
                value={value}
                onChange={(e) => handleChange(e, key)}
              />
            </div>
          ))}
          <button
            onClick={handleDownload}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
          >
            Descargar DOCX reemplazado
          </button>
        </div>
      )}
    </main>
  );
}
