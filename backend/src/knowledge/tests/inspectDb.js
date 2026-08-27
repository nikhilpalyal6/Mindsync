import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: 'E:/Mindsync/backend/.env' });

const MONGO_URI = process.env.MONGODB_URI;

const StudySessionSchema = new mongoose.Schema({
  title: String,
  resources: [
    {
      title: String,
      url: String,
      fileType: String
    }
  ]
});

const StudySession = mongoose.model('StudySession', StudySessionSchema, 'studysessions');

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected.');
  
  const workshopId = '6a7f79abef5cdb4faea09e1a';
  console.log(`Querying workshop ${workshopId}...`);
  const session = await StudySession.findById(workshopId);
  if (!session) {
    console.error('Workshop session not found in database.');
  } else {
    console.log('Workshop Session:', JSON.stringify(session, null, 2));
  }
  
  await mongoose.disconnect();
  console.log('Disconnected.');
}

run().catch(console.error);
