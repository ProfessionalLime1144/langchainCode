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

let pineconeIndex;
app.listen(process.env.PORT, () => {
  // Connect Pinecone
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
    environment: "gcp-starter"
  });
  
  (async () => {
    pineconeIndex = await pinecone.index(process.env.PINECONE_INDEX);
    console.log("pineconeIndex connected:\n" + pineconeIndex);
  })();
  
  console.log("Connected to Port " + process.env.PORT);
});

// Initialize vector datbaase
app.post("/initialize", async (req, res) => {
  const url = req.get("destinationPath");
  // const url = "https://dingwallasc.files.wordpress.com/2020/03/pscyho-cybernetics-book-maxwell-maltz.pdf";

  // Get file from URL returned as binary
  const response = await axios.get(url, { responseType: "arraybuffer" });
  
  console.log("awaiting response");
  
  if (response.status === 200) {
    try {
      // Convert binary data to text:
      const data = await PdfParse(response.data);
      await initializeVectorStore(data.text);
      await res.json({ successMessage: "VectorStore Successfully instantiated" });
    } catch(err) {
        res.json({ Error: "Error instantiating vectorstore." });
    }
  }
});

let vectorStore;
async function initializeVectorStore(text) {
  // chunks is an array of the file's text
  const textSplitter = new CharacterTextSplitter({
    separator: '\n',
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  const chunks = await textSplitter.createDocuments([text]);

  vectorStore = await PineconeStore.fromDocuments(chunks, new OpenAIEmbeddings(
    "gpt-3.5-turbo", { openAIApiKey: process.env.OPENAI_API_KEY }), { pineconeIndex });
  console.log("Store: " + JSON.stringify(vectorStore));
}

app.post("/input", async (req, res) => {
  const input = req.get("input");
  console.log("HEREISVECTORE" + vectorStore);
  console.log(typeof vectorStore);
  try {  
    const serverResponse = await langchain("What do you mean by that?", vectorStore);
    res.json({ serverResponse });
    console.log(serverResponse);    
  }
  catch(err) {
    res.send("ERROR: " + err);
    console.log(err);
  }}
);


async function langchain(input, vectorStore) {
  // Search for similar docs between the vector database and the input
  const docs = await vectorStore.similaritySearch(input, 3);

  // Create a chain WORKING ON IT
  const llm = new OpenAI();
  const chain = await loadQAChain(llm, { type: "stuff" });

  // Get resposne from chain
  let response;
  
  await chain.call({ input_documents: docs, question: input}).then(res => response = res.text);  
  return response;
};
