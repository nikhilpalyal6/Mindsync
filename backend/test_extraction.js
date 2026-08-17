import dotenv from 'dotenv';
import mongoose from 'mongoose';
import StudySession from './src/models/studySession.model.js';
import pdfExtractorService from './src/services/pdf/pdfExtractor.service.js';
import { connectDB, disconnectDB } from './src/database/connection.js';

dotenv.config();

async function test() {
  await connectDB();
  try {
    const session = await StudySession.findOne({ 
      'resources.title': 'Computer_Networks_22CS008_Detailed_Notes (1).pdf' 
    }).lean();

    if (!session) {
      console.error('Resource not found in database.');
      return;
    }

    const resource = session.resources.find(r => r.title === 'Computer_Networks_22CS008_Detailed_Notes (1).pdf');
    if (!resource || !resource.data || !resource.data.fileData) {
      console.error('Resource data or fileData is missing in DB.');
      return;
    }

    const fileDataUrl = resource.data.fileData;
    console.log(`Resource ID: ${resource._id}`);
    console.log(`fileData character length: ${fileDataUrl.length}`);
    console.log(`Configured Gemini Model: ${process.env.GEMINI_MODEL || 'gemini-3.5-flash'}`);

    console.log('\nStarting text extraction via Gemini API...');
    const startTime = Date.now();
    const extractedText = await pdfExtractorService.extractTextFromBase64(fileDataUrl);
    const duration = Date.now() - startTime;

    console.log(`\nExtraction completed in ${duration}ms.`);
    console.log(`Extracted text length: ${extractedText.length}`);
    
    if (extractedText.length > 0) {
      console.log('Preview of extracted text:');
      console.log(extractedText.slice(0, 500));
    } else {
      console.error('Extracted text is empty.');
    }
  } catch (err) {
    console.error('Test execution failed:', err);
  } finally {
    await disconnectDB();
  }
}

test();
