import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb+srv://nikhilpalyal6_db_user:spT6dVKWEmwA5s8M@mindsynccluster.lgxboqk.mongodb.net/mindsync?retryWrites=true&w=majority&appName=MindsyncCluster';

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;
    const studySessionsColl = db.collection('studysessions');
    
    const doc = await studySessionsColl.findOne({ _id: new mongoose.Types.ObjectId('6a7073a38199bc8ca5037b77') });
    console.log('JSON:', JSON.stringify(doc, null, 2));
  } catch (error) {
    console.error(error);
  } finally {
    await mongoose.disconnect();
  }
}

run();
