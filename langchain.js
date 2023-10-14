import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { OpenAI } from "langchain/llms/openai";
import { CharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { FaissStore } from "langchain/vectorstores/faiss";
import { BufferMemory } from "langchain/memory";
import { loadQAChain } from "langchain/chains";
import { awaitAllCallbacks } from "langchain/callbacks";
import { TokenTextSplitter } from "langchain/text_splitter";

async function langchain(input, destinationPath) {
  // Get PDF
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
