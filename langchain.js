import express from "express";
import mysql from 'mysql2';
import instantiateDatabase from "./instantiateDatabase.js";
import { CharacterTextSplitter, RecursiveCharacterTextSplitter } from "langchain/text_splitter"
import { pipeline, env, AutoModel, AutoTokenizer } from '@xenova/transformers';
import axios from "axios";
import PdfParse from "./modules/pdfParsed.js";

import summaryTool from "./modules/node-summary.js";

import { FaissStore } from "langchain/vectorstores/faiss";
import { HuggingFaceTransformersEmbeddings } from "langchain/embeddings/hf_transformers";

let hf = new HuggingFaceTransformersEmbeddings(
  {
    modelName: "Xenova/e5-small-v2"
  }
);

const app = express();

app.listen(3000, async () => {
  console.log("Connected to port 3000.");
});

app.get("/", async (req, res) => {
  const startTime = Date.now()
  let client = await instantiateDatabase();

  console.log("Call initiated.");
  // const url = req.get("destinationPath");
  const url = "https://bitcoin.org/bitcoin.pdf";
  
  // Get file from URL returned as binary
  const response = await axios.get(url, { responseType: "arraybuffer" });
  if (response.status === 200) {
    // Convert binary data to text and then embed it:
    const data = await PdfParse(response.data);
    const text = data.text;
    const splitter = new RecursiveCharacterTextSplitter({
      // chunkSize: Math.round(text.length / 800),
      chunkSize: 1700,
      chunkOverlap: 50
    });
    const docs = await splitter.createDocuments([text]);

    // Create VectorStore
    console.log("VectorStore being created...");
    const vectorStore = await FaissStore.fromDocuments(docs, hf);
    console.log("VectorStore created.");

    // Send VectorStore to SingleStore
    const sqlQuery = "INSERT INTO VECTORSTORE (fileUrl, vectorStore) VALUES (?, ?)";
    await client.execute(sqlQuery, [url, vectorStore],
      function (err, results, fields) {
        if (err) throw err;
        console.log(results);
        console.log("Embeddings successfuly saved to database.");
      }
    )
    client.query("SELECT * FROM VECTORSTORE",
      function(err, result, field) {
        if (err) throw err;
        res.send(field)
      }
    );
    console.log((Date.now() - startTime) / 1000);
  }
});
