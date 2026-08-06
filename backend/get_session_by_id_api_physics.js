import mongoose from 'mongoose';
import studyService from './src/services/study.service.js';
import ApiResponse from './src/utils/ApiResponse.js';

const MONGODB_URI = 'mongodb+srv://nikhilpalyal6_db_user:spT6dVKWEmwA5s8M@mindsynccluster.lgxboqk.mongodb.net/mindsync?retryWrites=true&w=majority&appName=MindsyncCluster';

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;
    const studySessionsColl = db.collection('studysessions');
    
    const doc = await studySessionsColl.findOne({ _id: new mongoose.Types.ObjectId('6a7073a38199bc8ca5037b77') });
    if (!doc) {
      console.log('Session not found in DB!');
      return;
    }

    const userId = doc.user;
    const session = await studyService.getSessionById(userId, '6a7073a38199bc8ca5037b77');
    const apiResponse = ApiResponse.success(session, 'Study session retrieved successfully');

    // Truncate base64/transcripts to keep output readable
    const cleanResponse = JSON.parse(JSON.stringify(apiResponse));
    if (cleanResponse.data && cleanResponse.data.resources) {
      cleanResponse.data.resources.forEach(r => {
        if (r.data) {
          for (const key of Object.keys(r.data)) {
            const val = r.data[key];
            if (typeof val === 'string' && val.length > 100) {
              r.data[key] = `${val.substring(0, 100)}... [TRUNCATED, len=${val.length}]`;
            } else if (Array.isArray(val)) {
              r.data[key] = `[Array of ${val.length} items]`;
            }
          }
        }
      });
    }
    if (cleanResponse.data && cleanResponse.data.metadata) {
      const meta = cleanResponse.data.metadata;
      for (const key of Object.keys(meta)) {
        const val = meta[key];
        if (val && typeof val === 'object') {
          for (const subKey of Object.keys(val)) {
            const subVal = val[subKey];
            if (typeof subVal === 'string' && subVal.length > 100) {
              meta[key][subKey] = `${subVal.substring(0, 100)}... [TRUNCATED, len=${subVal.length}]`;
            } else if (Array.isArray(subVal)) {
              meta[key][subKey] = `[Array of ${subVal.length} items]`;
            }
          }
        }
      }
    }
    
    console.log(JSON.stringify(cleanResponse, null, 2));

  } catch (error) {
    console.error('Error running script:', error);
  } finally {
    await mongoose.disconnect();
  }
}

run();
