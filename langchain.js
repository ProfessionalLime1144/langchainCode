const express = require("express");
const bodyParser = require("body-parser");
const { PDFLoader } = require("langchain/document_loaders/fs/pdf");
const { OpenAI } = require("langchain/llms/openai");
const { CharacterTextSplitter } = require("langchain/text_splitter");
const { OpenAIEmbeddings } = require("langchain/embeddings/openai");
const { FaissStore } = require("langchain/vectorstores/faiss");
const { BufferMemory } = require("langchain/memory");
const { loadQAChain } = require("langchain/chains");
const { awaitAllCallbacks } = require("langchain/callbacks");
const { TokenTextSplitter } = require("langchain/text_splitter");
const axios = require('axios');
const fs = require("fs");
const PdfParse = require("pdf-parse");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

app.listen(3000, () => {
  console.log("Connected to Port 3000");
});

app.get("/", async (req, res) => {
  // const input = req.get("input");
  // const url = req.get("destinationPath");
  const url = "https://dingwallasc.files.wordpress.com/2020/03/pscyho-cybernetics-book-maxwell-maltz.pdf";
  console.log("Awaiting Response.");
  try {
    // Get file from URL returned as binary
    const response = await axios.get(url, { responseType: "arraybuffer" });
    if (response.status === 200) {
      res.set({
        "Content-Type": "text/plain",
      });

      // Convert binary data to text:
      const data = await PdfParse(response.data);
      res.send(data.text)

      const serverResponse = await langchain("Explain this", data.text);
      console.log(serverResponse);
      
    } else {
      res.status(response.status).send('Failed to fetch the file.');
    }
  } catch(err) {
      console.log("Error: " + err);
      res.status(500).json({ error: "Internal server error: " + err.message });
    }
});

async function langchain(input, text) {
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
