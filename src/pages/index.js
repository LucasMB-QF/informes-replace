import { useState } from "react";
import mammoth from "mammoth";
import { saveAs } from "file-saver";
import { generateDocx } from "../utils/docxConverter";

export default function Home() {
  const [file, setFile] = useState(null);
  const [text, setText] = useState("");
  const [placeholders, setPlaceholders] = useState({
    patente: "",
    dl01: "",
    // agrega más campos que necesites reemplazar
  });

  // Cuando suben el archivo, leer texto con mammoth
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    setFile(file);

    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    setText(result.value);
  };

  // Reemplazar en el texto todos los campos {{clave}} con valores del formulario
  const handleReplace = () => {
    let replacedText = text;
    for (const key in placeholders) {
      const regex = new RegExp(`{{${key}}}`, "g");
      replacedText = replacedText.replace(regex, placeholders[key]);
    }
    setText(replacedText);
  };

  // Generar nuevo docx con el texto reemplazado
  const handleDownload = () => {
    const docxBlob = generateDocx(text);
    saveAs(docxBlob, "informe_reemplazado.docx");
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Reemplazador de informes DOCX</h1>
      <input type="file" accept=".docx" onChange={handleFileChange} />
      <div style={{ marginTop: 20 }}>
        {Object.keys(placeholders).map((key) => (
          <div key={key} style={{ marginBottom: 10 }}>
            <label>
              {key}:{" "}
              <input
                type="text"
                value={placeholders[key]}
                onChange={(e) =>
                  setPlaceholders({ ...placeholders, [key]: e.target.value })
                }
              />
            </label>
          </div>
        ))}
      </div>
      <button onClick={handleReplace}>Reemplazar campos</button>
      <button onClick={handleDownload} style={{ marginLeft: 10 }}>
        Descargar informe reemplazado
      </button>
      <pre style={{ whiteSpace: "pre-wrap", marginTop: 20 }}>{text}</pre>
    </div>
  );
}
