import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mindsync';

async function run() {
  await mongoose.connect(MONGODB_URI);
  const StudySession = (await import('../src/models/studySession.model.js')).default;
  const sessions = await StudySession.find({});
  console.log(`Found ${sessions.length} sessions.`);
  for (const session of sessions) {
    let modified = false;
    if (session.resources) {
      for (const r of session.resources) {
        if (r._id && r.data && r.data._id !== r._id.toString()) {
          r.data._id = r._id.toString();
          modified = true;
          console.log(`Setting data._id for resource ${r._id} in session ${session._id}`);
        }
      }
    }
    if (session.metadata) {
      if (session.metadata.pdf && session.metadata.pdf._id === undefined) {
        const matching = session.resources?.find(r => r.type === 'pdf' && (r.title === session.metadata.pdf.filename || r.title === session.metadata.pdf.pdfFilename));
        if (matching) {
          session.metadata.pdf._id = matching._id.toString();
          modified = true;
          console.log(`Setting metadata.pdf._id in session ${session._id}`);
        }
      }
      if (session.metadata.youtube && session.metadata.youtube._id === undefined) {
        const matching = session.resources?.find(r => r.type === 'youtube' && (r.url === session.metadata.youtube.videoUrl || r.url === session.metadata.youtube.url));
        if (matching) {
          session.metadata.youtube._id = matching._id.toString();
          modified = true;
          console.log(`Setting metadata.youtube._id in session ${session._id}`);
        }
      }
      if (session.metadata.notes && session.metadata.notes._id === undefined) {
        const matching = session.resources?.find(r => r.type === 'notes');
        if (matching) {
          session.metadata.notes._id = matching._id.toString();
          modified = true;
          console.log(`Setting metadata.notes._id in session ${session._id}`);
        }
      }
    }
    if (modified) {
      session.markModified('resources');
      session.markModified('metadata');
      await session.save();
    }
  }
  await mongoose.disconnect();
  console.log('Finished.');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
