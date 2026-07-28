import { YoutubeTranscript } from 'youtube-transcript';

async function test() {
  try {
    console.log('YoutubeTranscript:', YoutubeTranscript);
    const data = await YoutubeTranscript.fetchTranscript('dQw4w9WgXcQ');
    console.log('Success! Extracted raw segments count:', data.length);
  } catch (err) {
    console.error('Error during fetchTranscript:', err);
  }
}

test();
