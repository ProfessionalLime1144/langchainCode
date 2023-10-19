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
const PdfParse = require("pdf-parse");
const { Pinecone } = require("@pinecone-database/pinecone");
const { PineconeStore } = require("langchain/vectorstores/pinecone");

const app = express();
app.use(express.json());

app.listen(process.env.PORT, () => {
  console.log("Connected to Port " + process.env.PORT);
});

app.post("/", async (req, res) => {
  const input = req.get("input");
  const url = req.get("destinationPath");
  
  console.log("Awaiting Response.");
  try {
    // Get file from URL returned as binary
    const response = await axios.get(url, { responseType: "arraybuffer" });
    if (response.status === 200) {
      // Convert binary data to text:
      try {  
        const data = await PdfParse(response.data);

        const serverResponse = await langchain(input, data.text);
        console.log(serverResponse);
        res.json({ serverResponse });
        
      } catch(err) {
        console.log("Error: " + err);
        res.send(err)
      }
    } else {
      res.status(response.status).send('Failed to fetch the file.');
    }
  } catch(err) {
      console.log("Error: " + err);
      res.status(500).json({ error: "Internal server error: " + err.message });
    }
});

async function langchain(input, text) {
  // chunks is an array of the file's text
  const textSplitter = new CharacterTextSplitter({
    separator: '\n',
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  const chunks = await textSplitter.createDocuments([text]);
  
  const vectorStore = await PineconeStore.fromDocuments(chunks, new OpenAIEmbeddings(
    "gpt-3.5-turbo",
    {
      openAIApiKey: process.env.OPENAI_API_KEY
    }),{
    pineconeIndex,
    maxConcurrency: 5
  });
  const docs = await vectorStore.similaritySearch(input, 3);

  const llm = new OpenAI();
  const chain = await loadQAChain(llm, { type: "stuff" });
  
  let response;
  
  await chain.call({
    input_documents: docs,
    question: input
  }).then(res => response = res.text);
  
  return response;
};

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
  environment: "gcp-starter"
});

let pineconeIndex;
(async () => {
  pineconeIndex = await pinecone.index(process.env.PINECONE_INDEX);
})();
