import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb+srv://nikhilpalyal6_db_user:spT6dVKWEmwA5s8M@mindsynccluster.lgxboqk.mongodb.net/mindsync?retryWrites=true&w=majority&appName=MindsyncCluster';

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;
    const studySessionsColl = db.collection('studysessions');
    
    const sessions = await studySessionsColl.find({}).toArray();
    console.log(`Found ${sessions.length} sessions in DB.`);
    
    for (const session of sessions) {
      console.log(`\nSession ID: ${session._id}`);
      console.log(`Title: ${session.title}`);
      console.log(`Counts: pdf=${session.pdfCount}, youtube/video=${session.youtubeCount || session.videoCount}, notes=${session.notesCount}, flashcards=${session.flashcardsCount}, quiz=${session.quizCount}, chat=${session.chatCount}`);
      console.log(`Resources: count=${session.resources ? session.resources.length : 'undefined'}`);
      if (session.resources) {
        console.log(`Resources Types: ${session.resources.map(r => r.type).join(', ')}`);
      }
    }
  } catch (error) {
    console.error(error);
  } finally {
    await mongoose.disconnect();
  }
}

run();
