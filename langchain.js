import express from "express";
import bodyParser from "body-parser";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { OpenAI } from "langchain/llms/openai";
import { CharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { FaissStore } from "langchain/vectorstores/faiss";
import { BufferMemory } from "langchain/memory";
import { loadQAChain } from "langchain/chains";
import { awaitAllCallbacks } from "langchain/callbacks";
import { TokenTextSplitter } from "langchain/text_splitter";
import axios, {isCancel, AxiosError} from 'axios';
import fs from "fs";

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

app.listen(3000, () => {
  console.log("Connected to Port 3000");
});

app.post("/", async (req, res) => {
  const input = req.get("input");
  const url = req.get("destinationPath");
  
  try {
    // Get file from URL
    const response = await axios.get(url, { responseType: "stream "});
    if (response.status === 200) {
      const fileStream = response.data;

      // Create a writable stream to save the file to your server
      const writeStream = fs.createWriteStream('downloads/somefile.pdf'); // Replace with the desired path on your server

      fileStream.pipe(writeStream);

      writeStream.on('finish', () => {
        res.send('File downloaded and saved successfully.');
      });
    } else {
      res.status(response.status).send('Failed to fetch the file.');
    }
  } catch(err) {
      console.log("Error: " + err);
      res.status(500).json({ error: "Internal server error: " + err.message });
    }
});


async function langchain(input, destinationPath) {
  // // Get PDF
  const loader = new PDFLoader(destinationPath);
  const pdfDoc = await loader.load();
  // Get only the text portion  
  let text = "";
  for (let i = 0; i < pdfDoc.length; i++) {
    text += await pdfDoc[i].pageContent;
  }
  // chunks is an array
  const textSplitter = new CharacterTextSplitter({
    separator: '\n',
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  const chunks = await textSplitter.createDocuments([text]);
  const knowledgeBase = await FaissStore.fromDocuments(chunks, new OpenAIEmbeddings("gpt-3.5-turbo", {
    openAIApiKey: process.env.OPENAI_API_KEY
  }));
  const docs = await knowledgeBase.similaritySearch(input);
  const llm = new OpenAI();
  const chain = await loadQAChain(llm, { type: "stuff" });
  const cb = await awaitAllCallbacks();
  let response;
  await chain.call({
    input_documents: docs,
    question: input
  }).then(res => response = res.text);
  return await response;
}
