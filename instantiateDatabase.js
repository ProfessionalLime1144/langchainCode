import mysql from 'mysql2';
import { config } from "dotenv";

config();

//Modify the connection details to match the details specified while
//deploying the SingleStore workspace:
const HOST = process.env.ADMIN_ENDPOINT;
const USER = process.env.USER;
const PASSWORD = process.env.ADMIN_PASSWORD;
const DATABASE = process.env.DATABASE;

// main is run at the end
async function instantiateDatabase() {
 let singleStoreConnection;
 try {
   singleStoreConnection = await mysql.createConnection({
     host: HOST,
     user: USER,
     password: PASSWORD,
     database: DATABASE
   });

   console.log("You have successfully connected to SingleStore.");

   return singleStoreConnection;
   
  } catch (err) { 
   console.error('ERROR', err);
   process.exit(1);
 }
}


export default instantiateDatabase;