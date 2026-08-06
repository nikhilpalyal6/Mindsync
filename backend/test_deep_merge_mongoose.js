import mongoose from 'mongoose';
import StudySession from './src/models/studySession.model.js';

const MONGODB_URI = 'mongodb+srv://nikhilpalyal6_db_user:spT6dVKWEmwA5s8M@mindsynccluster.lgxboqk.mongodb.net/mindsync?retryWrites=true&w=majority&appName=MindsyncCluster';

function deepMerge(target, source) {
  if (!source || typeof source !== 'object') return target;
  if (!target || typeof target !== 'object') return source;

  const result = Array.isArray(target) ? [...target] : { ...target };

  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    const session = await StudySession.findOne({ _id: '6a7073a38199bc8ca5037b77' });
    console.log('Original metadata pdf keys:', Object.keys(session.metadata?.pdf || {}));

    const updates = {
      metadata: {
        activeResourceType: 'pdf',
        lastTab: 'pdf',
        lastOpened: new Date().toISOString()
      }
    };

    console.log('Performing deepMerge...');
    const merged = deepMerge(session.metadata || {}, updates.metadata || {});
    console.log('Merged metadata activeResourceType:', merged.activeResourceType);
    console.log('Merged metadata pdf keys:', Object.keys(merged.pdf || {}));
    
    // Check if the pdf key is STILL present in merged!
    if (merged.pdf) {
      console.log('SUCCESS: pdf metadata is preserved!');
    } else {
      console.log('FAIL: pdf metadata was lost!');
    }

  } catch (error) {
    console.error(error);
  } finally {
    await mongoose.disconnect();
  }
}

run();
